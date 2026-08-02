/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ALASKA_HOOK_CHANNEL, IAlaskaHookHostService } from '../../../../platform/alaskaHooks/common/alaskaHooks.js';

// @ts-expect-error: service is implemented via proxy
class AlaskaHookHostRendererService implements IAlaskaHookHostService {
	declare readonly _serviceBrand: undefined;
	constructor(@IMainProcessService mainProcessService: IMainProcessService) {
		return ProxyChannel.toService<IAlaskaHookHostService>(mainProcessService.getChannel(ALASKA_HOOK_CHANNEL));
	}
}

registerSingleton(IAlaskaHookHostService, AlaskaHookHostRendererService, InstantiationType.Delayed);
