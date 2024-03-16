/**
 * External dependencies
 */
import removeAccents from 'remove-accents';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState, useMemo, useCallback, useEffect } from '@wordpress/element';
import { useEntityRecords } from '@wordpress/core-data';
import { decodeEntities } from '@wordpress/html-entities';
import { parse } from '@wordpress/blocks';
import {
	BlockPreview,
	privateApis as blockEditorPrivateApis,
} from '@wordpress/block-editor';
import {
	DataViews,
	sortByTextFields,
	getPaginationResults,
} from '@wordpress/dataviews';
import { privateApis as routerPrivateApis } from '@wordpress/router';

/**
 * Internal dependencies
 */
import Page from '../page';
import { default as Link, useLink } from '../routes/link';
import {
	TEMPLATE_POST_TYPE,
	TEMPLATE_PART_POST_TYPE,
	OPERATOR_IS_ANY,
	OPERATOR_IS_NONE,
	LAYOUT_GRID,
	LAYOUT_TABLE,
	LAYOUT_LIST,
} from '../../utils/constants';
// import {
// 	useResetTemplateAction,
// 	deleteTemplateAction,
// 	renameTemplateAction,
// } from './actions';
import { postRevisionsAction } from '../actions';
import usePatternSettings from '../page-patterns/use-pattern-settings';
import { unlock } from '../../lock-unlock';
import { use } from '@wordpress/data';

const { ExperimentalBlockEditorProvider, useGlobalStyle } = unlock(
	blockEditorPrivateApis
);
const { useHistory, useLocation } = unlock( routerPrivateApis );

export default function PageCategory() {
	const { params } = useLocation();

	const { records, isResolving: isLoadingData } = useEntityRecords(
		'taxonomy',
		'category',
		{
			per_page: -1,
		}
	);
	const history = useHistory();
	const [ fields, setFields ] = useState( null );

	// Make an OPTIONS request to /wp/v2/category/termId to get the list of available fields.
	const { termId } = params;
	useEffect( () => {
		if ( termId ) {
			fetch( `/wp-json/wp/v2/categories/${ termId }`, {
				method: 'OPTIONS',
			} ).then( async ( response ) => {
				const data = await response.json();
				setFields( data.schema?.properties );
			} );
		}
	}, [ termId ] );

	return (
		<Page className="edit-site-page-category" title={ __( 'Category' ) }>
			Hello, category!
			{ fields &&
				Object.keys( fields ).map( ( key ) => {
					const field = fields[ key ];
					switch ( field.type ) {
						case 'string':
							return <input type="input" value={ 'foo' } />;
					}
					return <div key={ key }>{ fields[ key ].description }</div>;
				} ) }
		</Page>
	);
}
