// Utility functions
function trim( str ) {
	return str.trim();
}

function parseNumber( str ) {
	const num = parseFloat( str );
	return isNaN( num ) ? null : num;
}

function parseDescriptor( descriptor ) {
	const num = parseNumber( descriptor.slice( 0, -1 ) );
	if ( descriptor.slice( -1 ) === 'w' ) {
		return { width: num };
	} else if ( descriptor.slice( -1 ) === 'h' ) {
		return { height: num };
	} else if ( descriptor.slice( -1 ) === 'x' ) {
		return { density: num };
	}
	return {};
}

// Core functions
function parseSrcset( srcset ) {
	return srcset
		.split( ',' )
		.map( trim )
		.map( ( source ) => {
			const [ url, ...descriptors ] = source.split( /\s+/ );
			const properties = descriptors
				.map( parseDescriptor )
				.reduce( ( a, b ) => Object.assign( a, b ), {} );
			return { url, ...properties };
		} );
}

function parseSizes( sizes ) {
	return sizes
		.split( ',' )
		.map( trim )
		.map( ( size ) => {
			const [ media, value ] = size.split( /\s+(?=\d)/ );
			return { media: trim( media ), value: parseNumber( value ) };
		} );
}

// WordPress functions
async function fetchCustomImageSizes( attachmentId ) {
	try {
		const response = await fetch(
			`/wp-json/wp/v2/media/${ attachmentId }`
		);
		const data = await response.json();

		if ( data.media_details && data.media_details.sizes ) {
			const customSizes = Object.entries( data.media_details.sizes ).map(
				( [ sizeName, sizeData ] ) => {
					return {
						name: sizeName,
						width: sizeData.width,
						height: sizeData.height,
					};
				}
			);

			return customSizes;
		}
	} catch ( error ) {
		console.error( 'Error fetching custom image sizes:', error );
	}
}

// Perform checks and calculations to validate the sizes attribute based on the srcset.
// Update the `isValid` variable and add any issues to the `reasons` array as necessary.
async function checkSizes( media ) {
	const sizes = media?.sizes;
	const srcset = media?.srcset;
	const parsedSizes = parseSizes( sizes );
	const parsedSrcset = parseSrcset( srcset );
	const isValid = true;
	const reasons = [];
	const { select } = wp.data;
	const selectedBlock = select( 'core/block-editor' ).getSelectedBlock();

	// Before we get started, double check to ensure selectedBlock === 'core/image'
	if ( selectedBlock && selectedBlock.name !== 'core/image' ) {
		isValid = false;
		reasons.push( 'Selected block is not an image.' );
	}

	// Get the DOM element of the selected block using its clientId as well as the attachmentId
	const clientId = selectedBlock.clientId;
	const attachmentId = selectedBlock.attributes.id;
	const imgElement = document.querySelector( `[data-block="${ clientId }"]` );

	// Check #1 - Check if sizes attribute covers all viewport widths
	const sizesCoverAllViewportWidths = parsedSizes.some( ( size ) => {
		return (
			size.media === '100vw' ||
			size.media.includes( '(max-width: 300px)' ) ||
			size.media.includes( '(max-width: 768px)' ) ||
			size.media.includes( '(max-width: 1024px)' ) ||
			size.media.includes( '(max-width: 1536px)' ) ||
			size.media.includes( '(max-width: 2048px)' )
		);
	} );
	if ( ! sizesCoverAllViewportWidths ) {
		isValid = false;
		reasons.push(
			'The sizes attribute does not cover all viewport widths.'
		);
	}

	// Check #2 - Check if the largest image in srcset has a corresponding size
	const largestImage = parsedSrcset.reduce( ( prev, current ) =>
		prev.width > current.width ? prev : current
	);
	const hasLargestImageSize = parsedSizes.some(
		( size ) => size.value >= largestImage.width
	);
	if ( ! hasLargestImageSize ) {
		isValid = false;
		reasons.push(
			'The largest image in srcset does not have a corresponding size.'
		);
	}

	// Check #3 - Check if any sizes value is larger than the container width
	// Calculate container max width dynamically
	const contentWidth = imgElement.offsetWidth;
	const alignment =
		select( 'core/block-editor' ).getBlockAttributes( clientId ).align;

	let containerMaxWidth;
	switch ( alignment ) {
		case 'alignwide':
			containerMaxWidth = contentWidth * 1.25;
			break;
		case 'alignfull':
			containerMaxWidth = window.innerWidth;
			break;
		default:
			containerMaxWidth = contentWidth;
	}

	// See if any sizes value is larger than the container max width
	const hasOversizedSize = parsedSizes.some(
		( size ) => size.value > containerMaxWidth
	);
	if ( hasOversizedSize ) {
		isValid = false;
		reasons.push(
			'One or more sizes values are larger than the container max width.'
		);
	}

	// Check #4 - Add custom image sizes check
	const customImageSizes = fetchCustomImageSizes( attachmentId );
	customImageSizes.forEach( ( customSize ) => {
		const customSizeInSizes = parsedSizes.some( ( size ) =>
			size.media.includes( customSize.name )
		);

		if ( ! customSizeInSizes ) {
			isValid = false;
			reasons.push(
				`The sizes attribute does not include the custom image size: ${ customSize.name }.`
			);
		}
	} );

	// Check #5 - Add High DPI Displays check
	const hasHighDPISrc = parsedSrcset.some(
		( source ) => source.density && source.density >= 2
	);

	if ( ! hasHighDPISrc ) {
		isValid = false;
		reasons.push(
			'The srcset attribute does not include images for High DPI Displays.'
		);
	}

	// Check #6 - Check if the image has '.is-resized' class and dimensions have been changed
	const isResized = imgElement.classList.contains( 'is-resized' );
	const hasChangedDimensions =
		imgElement.naturalWidth !== imgElement.width ||
		imgElement.naturalHeight !== imgElement.height;

	if ( isResized && hasChangedDimensions ) {
		const resizedWidth = imgElement.width;
		const hasAppropriateSize = parsedSizes.some(
			( size ) => size.value >= resizedWidth
		);

		if ( ! hasAppropriateSize ) {
			isValid = false;
			reasons.push(
				'The image has the ".is-resized" class, its dimensions have been changed, and the sizes attribute does not include an appropriate size for the resized image.'
			);
		}
	}

	// Check #7 - Check if the image size has been set to Thumbnail, Medium, Large, or Full Size or if the attributes in srcset don't match the custom size
	async function checkPresetImageSize() {
		const customImageSizes = await fetchCustomImageSizes( attachmentId );
		const imageSizeNames = [ 'thumbnail', 'medium', 'large', 'full' ];
		const presetImageSizes = customImageSizes.filter( ( size ) =>
			imageSizeNames.includes( size.name )
		);

		const hasPresetSize = presetImageSizes.some( ( size ) => {
			const matchingSize = parsedSizes.find( ( parsedSize ) =>
				parsedSize.media.includes( size.name )
			);
			if ( ! matchingSize ) return false;

			if ( size.name === 'full' ) {
				return (
					imgElement.naturalWidth === imgElement.width &&
					imgElement.naturalHeight === imgElement.height
				);
			}
			return (
				size.width === matchingSize.value ||
				size.height === matchingSize.value
			);
		} );

		if ( ! hasPresetSize ) {
			isValid = false;
			reasons.push(
				'The image size is not set to Thumbnail, Medium, Large, or Full Size, or the sizes attribute does not have a corresponding media query for the preset size.'
			);
		}
	}

	await checkPresetImageSize();

	return {
		isValid,
		reasons,
	};
}

// Export the checkSizes function
export default checkSizes;
