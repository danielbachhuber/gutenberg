/**
 * Internal dependencies
 */
import SpacingRangeControl from './spacing-range-control';
import {
	ALL_SIDES,
	LABELS,
	getAllValue,
	isValuesMixed,
	isValuesDefined,
} from './utils';

const noop = () => {};

export default function AllInputControl( {
	onChange = noop,
	onFocus = noop,
	values,
	sides,
	...props
} ) {
	const allValue = getAllValue( values, sides );
	const hasValues = isValuesDefined( values );
	const isMixed = hasValues && isValuesMixed( values, sides );
	const allPlaceholder = isMixed ? LABELS.mixed : null;

	const handleOnFocus = ( event ) => {
		onFocus( event, { side: 'all' } );
	};

	// Applies a value to an object representing top, right, bottom and left
	// sides while taking into account any custom side configuration.
	const applyValueToSides = ( currentValues, newValue ) => {
		const newValues = { ...currentValues };

		if ( sides?.length ) {
			sides.forEach( ( side ) => {
				if ( side === 'vertical' ) {
					newValues.top = newValue;
					newValues.bottom = newValue;
				} else if ( side === 'horizontal' ) {
					newValues.left = newValue;
					newValues.right = newValue;
				} else {
					newValues[ side ] = newValue;
				}
			} );
		} else {
			ALL_SIDES.forEach( ( side ) => ( newValues[ side ] = newValue ) );
		}

		return newValues;
	};

	const handleOnChange = ( next ) => {
		const nextValues = applyValueToSides( values, next );

		onChange( nextValues );
	};

	return (
		<SpacingRangeControl
			{ ...props }
			isOnly
			value={ allValue }
			onChange={ handleOnChange }
			onFocus={ handleOnFocus }
			placeholder={ allPlaceholder }
			withInputField={ false }
		/>
	);
}