/**
 * WordPress dependencies
 */
import { useState, useMemo, useCallback } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { DataViews } from '../index';
import { DEFAULT_VIEW, actions, data } from './fixtures';
import {
	LAYOUT_GRID,
	LAYOUT_TABLE,
	OPERATOR_IS_NONE,
	OPERATOR_IS_ANY,
} from '../constants';

const meta = {
	title: 'DataViews/DataViews',
	component: DataViews,
};
export default meta;

const defaultConfigPerViewType = {
	[ LAYOUT_TABLE ]: {
		primaryField: 'title',
	},
	[ LAYOUT_GRID ]: {
		mediaField: 'image',
		primaryField: 'title',
	},
};

function normalizeSearchInput( input = '' ) {
	return input.trim().toLowerCase();
}

const fields = [
	{
		header: 'Image',
		id: 'image',
		render: ( { item } ) => {
			return (
				<img src={ item.image } alt="" style={ { width: '100%' } } />
			);
		},
		width: 50,
		enableSorting: false,
	},
	{
		header: 'Title',
		id: 'title',
		maxWidth: 400,
		enableHiding: false,
	},
	{
		header: 'Type',
		id: 'type',
		maxWidth: 400,
		enableHiding: false,
		type: 'enumeration',
		elements: [
			{ value: 'Not a planet', label: 'Not a planet' },
			{ value: 'Ice giant', label: 'Ice giant' },
			{ value: 'Terrestrial', label: 'Terrestrial' },
			{ value: 'Gas giant', label: 'Gas giant' },
		],
	},
	{
		header: 'Description',
		id: 'description',
		maxWidth: 200,
		enableSorting: false,
	},
];

export const Default = ( props ) => {
	const [ view, setView ] = useState( DEFAULT_VIEW );
	const { shownData, paginationInfo } = useMemo( () => {
		let filteredData = [ ...data ];
		// Handle global search.
		if ( view.search ) {
			const normalizedSearch = normalizeSearchInput( view.search );
			filteredData = filteredData.filter( ( item ) => {
				return [
					normalizeSearchInput( item.title ),
					normalizeSearchInput( item.description ),
				].some( ( field ) => field.includes( normalizedSearch ) );
			} );
		}

		if ( view.filters.length > 0 ) {
			view.filters.forEach( ( filter ) => {
				if (
					filter.field === 'type' &&
					filter.operator === OPERATOR_IS_ANY &&
					filter?.value?.length > 0
				) {
					filteredData = filteredData.filter( ( item ) => {
						return filter.value.includes( item.type );
					} );
				} else if (
					filter.field === 'type' &&
					filter.operator === OPERATOR_IS_NONE &&
					filter?.value?.length > 0
				) {
					filteredData = filteredData.filter( ( item ) => {
						return ! filter.value.includes( item.type );
					} );
				}
			} );
		}

		// Handle sorting.
		if ( view.sort ) {
			const stringSortingFields = [ 'title' ];
			const fieldId = view.sort.field;
			if ( stringSortingFields.includes( fieldId ) ) {
				const fieldToSort = fields.find( ( field ) => {
					return field.id === fieldId;
				} );
				filteredData.sort( ( a, b ) => {
					const valueA = fieldToSort.getValue( { item: a } ) ?? '';
					const valueB = fieldToSort.getValue( { item: b } ) ?? '';
					return view.sort.direction === 'asc'
						? valueA.localeCompare( valueB )
						: valueB.localeCompare( valueA );
				} );
			}
		}
		// Handle pagination.
		const start = ( view.page - 1 ) * view.perPage;
		const totalItems = filteredData?.length || 0;
		filteredData = filteredData?.slice( start, start + view.perPage );
		return {
			shownData: filteredData,
			paginationInfo: {
				totalItems,
				totalPages: Math.ceil( totalItems / view.perPage ),
			},
		};
	}, [ view ] );
	const onChangeView = useCallback(
		( newView ) => {
			if ( newView.type !== view.type ) {
				newView = {
					...newView,
					layout: {
						...defaultConfigPerViewType[ newView.type ],
					},
				};
			}

			setView( newView );
		},
		[ view.type, setView ]
	);
	return (
		<DataViews
			{ ...props }
			paginationInfo={ paginationInfo }
			data={ shownData }
			view={ view }
			fields={ fields }
			onChangeView={ onChangeView }
		/>
	);
};
Default.args = {
	actions,
	supportedLayouts: [ LAYOUT_TABLE, LAYOUT_GRID ],
};
