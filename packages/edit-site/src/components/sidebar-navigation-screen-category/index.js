/**
 * WordPress dependencies
 */
import {
	__experimentalItemGroup as ItemGroup,
	__experimentalItem as Item,
	__experimentalTruncate as Truncate,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useEntityRecords, store as coreStore } from '@wordpress/core-data';
import { decodeEntities } from '@wordpress/html-entities';
import { privateApis as routerPrivateApis } from '@wordpress/router';
import { layout, page, home, verse, plus } from '@wordpress/icons';
import { useSelect } from '@wordpress/data';
import { useViewportMatch } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import SidebarNavigationScreen from '../sidebar-navigation-screen';
import { useLink } from '../routes/link';
import SidebarNavigationItem from '../sidebar-navigation-item';
import SidebarButton from '../sidebar-button';
import AddNewPageModal from '../add-new-page';
import { unlock } from '../../lock-unlock';
import { TEMPLATE_POST_TYPE } from '../../utils/constants';

export default function SidebarNavigationScreenCategory( { backPath } ) {
	return (
		<>
			<SidebarNavigationScreen
				title={ __( 'Category' ) }
				description={ __( 'This is an individual category.' ) }
				backPath={ backPath }
			/>
		</>
	);
}
