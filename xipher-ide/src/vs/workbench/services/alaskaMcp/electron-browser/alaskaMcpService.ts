/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAlaskaMcpService, ALASKA_MCP_CHANNEL } from '../../../../platform/alaskaMcp/common/alaskaMcp.js';

// @ts-expect-error: service is implemented via proxy
class AlaskaMcpRendererService implements IAlaskaMcpService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		return ProxyChannel.toService<IAlaskaMcpService>(mainProcessService.getChannel(ALASKA_MCP_CHANNEL));
	}
}

registerSingleton(IAlaskaMcpService, AlaskaMcpRendererService, InstantiationType.Delayed);
