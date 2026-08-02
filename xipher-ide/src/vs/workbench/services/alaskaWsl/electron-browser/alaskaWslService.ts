/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAlaskaWslService, ALASKA_WSL_CHANNEL } from '../../../../platform/alaskaWsl/common/alaskaWsl.js';

// @ts-expect-error: service is implemented via proxy
class AlaskaWslRendererService implements IAlaskaWslService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		return ProxyChannel.toService<IAlaskaWslService>(mainProcessService.getChannel(ALASKA_WSL_CHANNEL));
	}
}

registerSingleton(IAlaskaWslService, AlaskaWslRendererService, InstantiationType.Delayed);
