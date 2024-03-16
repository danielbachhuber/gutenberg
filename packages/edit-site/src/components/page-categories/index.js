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

const { ExperimentalBlockEditorProvider, useGlobalStyle } = unlock(
	blockEditorPrivateApis
);
const { useHistory, useLocation } = unlock( routerPrivateApis );

const EMPTY_ARRAY = [];

const defaultConfigPerViewType = {
	[ LAYOUT_TABLE ]: {
		primaryField: 'title',
	},
	[ LAYOUT_GRID ]: {
		mediaField: 'preview',
		primaryField: 'title',
	},
	[ LAYOUT_LIST ]: {
		primaryField: 'title',
		mediaField: 'preview',
	},
};

const DEFAULT_VIEW = {
	type: LAYOUT_TABLE,
	search: '',
	page: 1,
	perPage: 20,
	sort: {
		field: 'title',
		direction: 'asc',
	},
	// All fields are visible by default, so it's
	// better to keep track of the hidden ones.
	hiddenFields: [ 'preview' ],
	layout: defaultConfigPerViewType[ LAYOUT_TABLE ],
	filters: [],
};

function normalizeSearchInput( input = '' ) {
	return removeAccents( input.trim().toLowerCase() );
}

function Title( { item, viewType } ) {
	if ( viewType === LAYOUT_LIST ) {
		return decodeEntities( item.name ) || __( '(no title)' );
	}
	const linkProps = {
		params: {
			path: '/category',
			termId: item.id,
		},
	};
	return (
		<Link { ...linkProps }>
			{ decodeEntities( item.name ) || __( '(no title)' ) }
		</Link>
	);
}

function Preview( { item, viewType } ) {
	const settings = usePatternSettings();
	const [ backgroundColor = 'white' ] = useGlobalStyle( 'color.background' );
	const blocks = useMemo( () => {
		return parse( item.content.raw );
	}, [ item.content.raw ] );
	const { onClick } = useLink( {
		taxonomy: 'category',
		termId: item.id,
	} );

	const isEmpty = ! blocks?.length;
	// Wrap everything in a block editor provider to ensure 'styles' that are needed
	// for the previews are synced between the site editor store and the block editor store.
	// Additionally we need to have the `__experimentalBlockPatterns` setting in order to
	// render patterns inside the previews.
	// TODO: Same approach is used in the patterns list and it becomes obvious that some of
	// the block editor settings are needed in context where we don't have the block editor.
	// Explore how we can solve this in a better way.
	return (
		<ExperimentalBlockEditorProvider settings={ settings }>
			<div
				className={ `page-templates-preview-field is-viewtype-${ viewType }` }
				style={ { backgroundColor } }
			>
				{ viewType === LAYOUT_LIST && ! isEmpty && (
					<BlockPreview blocks={ blocks } />
				) }
				{ viewType !== LAYOUT_LIST && (
					<button
						className="page-templates-preview-field__button"
						type="button"
						onClick={ onClick }
						aria-label={ item.title?.rendered || item.title }
					>
						{ isEmpty &&
							( item.type === TEMPLATE_POST_TYPE
								? __( 'Empty template' )
								: __( 'Empty template part' ) ) }
						{ ! isEmpty && <BlockPreview blocks={ blocks } /> }
					</button>
				) }
			</div>
		</ExperimentalBlockEditorProvider>
	);
}

export default function PageCategories() {
	const { params } = useLocation();
	const { activeView = 'all', layout } = params;
	const defaultView = useMemo( () => {
		const usedType = layout ?? DEFAULT_VIEW.type;
		return {
			...DEFAULT_VIEW,
			type: usedType,
			layout: defaultConfigPerViewType[ usedType ],
			filters:
				activeView !== 'all'
					? [
							{
								field: 'author',
								operator: 'isAny',
								value: [ activeView ],
							},
					  ]
					: [],
		};
	}, [ layout, activeView ] );
	const [ view, setView ] = useState( defaultView );
	useEffect( () => {
		setView( ( currentView ) => ( {
			...currentView,
			filters:
				activeView !== 'all'
					? [
							{
								field: 'author',
								operator: OPERATOR_IS_ANY,
								value: [ activeView ],
							},
					  ]
					: [],
		} ) );
	}, [ activeView ] );

	const { records, isResolving: isLoadingData } = useEntityRecords(
		'taxonomy',
		'category',
		{
			per_page: -1,
		}
	);
	const history = useHistory();
	const onSelectionChange = useCallback(
		( items ) => {
			if ( view?.type === LAYOUT_LIST ) {
				history.push( {
					...params,
					postId: items.length === 1 ? items[ 0 ].id : undefined,
				} );
			}
		},
		[ history, params, view?.type ]
	);

	const fields = useMemo( () => {
		const _fields = [
			{
				header: __( 'Preview' ),
				id: 'preview',
				render: ( { item } ) => {
					return <Preview item={ item } viewType={ view.type } />;
				},
				minWidth: 120,
				maxWidth: 120,
				enableSorting: false,
			},
			{
				header: __( 'Category' ),
				id: 'title',
				getValue: ( { item } ) => item.title?.rendered,
				render: ( { item } ) => (
					<Title item={ item } viewType={ view.type } />
				),
				maxWidth: 400,
				enableHiding: false,
			},
		];
		return _fields;
	}, [ view.type ] );

	const { data, paginationInfo } = useMemo( () => {
		if ( ! records ) {
			return {
				data: EMPTY_ARRAY,
				paginationInfo: { totalItems: 0, totalPages: 0 },
			};
		}
		let filteredData = [ ...records ];
		// Handle global search.
		if ( view.search ) {
			const normalizedSearch = normalizeSearchInput( view.search );
			filteredData = filteredData.filter( ( item ) => {
				const title = item.title?.rendered || item.slug;
				return (
					normalizeSearchInput( title ).includes(
						normalizedSearch
					) ||
					normalizeSearchInput( item.description ).includes(
						normalizedSearch
					)
				);
			} );
		}

		// Handle filters.
		if ( view.filters.length > 0 ) {
			view.filters.forEach( ( filter ) => {
				if (
					filter.field === 'author' &&
					filter.operator === OPERATOR_IS_ANY &&
					filter?.value?.length > 0
				) {
					filteredData = filteredData.filter( ( item ) => {
						return filter.value.includes( item.author_text );
					} );
				} else if (
					filter.field === 'author' &&
					filter.operator === OPERATOR_IS_NONE &&
					filter?.value?.length > 0
				) {
					filteredData = filteredData.filter( ( item ) => {
						return ! filter.value.includes( item.author_text );
					} );
				}
			} );
		}

		// Handle sorting.
		if ( view.sort ) {
			filteredData = sortByTextFields( {
				data: filteredData,
				view,
				fields,
				textFields: [ 'title', 'author' ],
			} );
		}
		// Handle pagination.
		return getPaginationResults( {
			data: filteredData,
			view,
		} );
	}, [ records, view, fields ] );

	// const resetTemplateAction = useResetTemplateAction();
	const actions = useMemo(
		() => [
			// resetTemplateAction,
			// renameTemplateAction,
			postRevisionsAction,
			// deleteTemplateAction,
		],
		[]
	);

	const onChangeView = useCallback(
		( newView ) => {
			if ( newView.type !== view.type ) {
				newView = {
					...newView,
					layout: {
						...defaultConfigPerViewType[ newView.type ],
					},
				};

				history.push( {
					...params,
					layout: newView.type,
				} );
			}

			setView( newView );
		},
		[ view.type, setView, history, params ]
	);

	return (
		<Page
			className="edit-site-page-categories-dataviews"
			title={ __( 'Categories' ) }
		>
			<DataViews
				paginationInfo={ paginationInfo }
				fields={ fields }
				actions={ actions }
				data={ data }
				isLoading={ isLoadingData }
				view={ view }
				onChangeView={ onChangeView }
				onSelectionChange={ onSelectionChange }
				deferredRendering={ ! view.hiddenFields?.includes( 'preview' ) }
			/>
		</Page>
	);
}
