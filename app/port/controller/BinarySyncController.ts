import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import path from 'path';
import { NotFoundError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { BinarySyncerService } from '../../core/service/BinarySyncerService';
import { Binary } from '../../core/entity/Binary';

@HTTPController()
export class BinarySyncController extends AbstractController {
  @Inject()
  private binarySyncerService: BinarySyncerService;

  @HTTPMethod({
    path: '/-/binary/:binaryName/:subpath(.*)',
    method: HTTPMethodEnum.GET,
  })
  async showBinary(@Context() ctx: EggContext, @HTTPParam() binaryName: string, @HTTPParam() subpath: string) {
    subpath = subpath || '/';
    if (subpath === '/') {
      const items = await this.binarySyncerService.listRootBinaries(binaryName);
      return this.formatItems(items);
    }
    subpath = `/${subpath}`;
    const parsed = path.parse(subpath);
    const parent = parsed.dir === '/' ? '/' : `${parsed.dir}/`;
    const name = subpath.endsWith('/') ? `${parsed.base}/` : parsed.base;
    const binary = await this.binarySyncerService.findBinary(binaryName, parent, name);
    if (!binary) {
      throw new NotFoundError(`Binary "${binaryName}${subpath}" not found`);
    }
    if (binary.isDir) {
      const items = await this.binarySyncerService.listDirBinaries(binary);
      return this.formatItems(items);
    }

    // download file
    const urlOrStream = await this.binarySyncerService.downloadBinary(binary);
    if (!urlOrStream) {
      throw new NotFoundError(`Binary "${binaryName}${subpath}" not found`);
    }
    if (typeof urlOrStream === 'string') {
      ctx.redirect(urlOrStream);
      return;
    }
    ctx.attachment(name);
    return urlOrStream;
  }

  @HTTPMethod({
    path: '/-/binary/:binary',
    method: HTTPMethodEnum.GET,
  })
  async showBinaryIndex(@Context() ctx: EggContext, @HTTPParam() binary: string) {
    return await this.showBinary(ctx, binary, '/');
  }

  private formatItems(items: Binary[]) {
    return items.map(item => {
      return {
        id: item.binaryId,
        category: item.category,
        name: item.name,
        date: item.date,
        type: item.isDir ? 'dir' : 'file',
        size: item.isDir ? undefined : item.size,
        url: `${this.config.cnpmcore.registry}/-/binary/${item.category}${item.parent}${item.name}`,
        modified: item.updatedAt,
      };
    });
  }
}