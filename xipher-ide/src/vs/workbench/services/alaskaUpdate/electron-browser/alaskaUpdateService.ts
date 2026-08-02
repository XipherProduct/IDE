/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ALASKA_UPDATE_CHANNEL, IAlaskaUpdateMainService } from '../../../../platform/alaskaUpdate/common/alaskaUpdate.js';

// @ts-expect-error: service is implemented via proxy
class AlaskaUpdateRendererService implements IAlaskaUpdateMainService {
	declare readonly _serviceBrand: undefined;
	constructor(@IMainProcessService mainProcessService: IMainProcessService) {
		return ProxyChannel.toService<IAlaskaUpdateMainService>(mainProcessService.getChannel(ALASKA_UPDATE_CHANNEL));
	}
}

registerSingleton(IAlaskaUpdateMainService, AlaskaUpdateRendererService, InstantiationType.Delayed);
