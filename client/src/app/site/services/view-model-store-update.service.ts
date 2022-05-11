import { Injectable } from '@angular/core';
import { DataStoreService } from 'src/app/site/services/data-store.service';
import { DataStoreUpdateManagerService } from 'src/app/site/services/data-store-update-manager.service';
import { CollectionMapperService } from 'src/app/site/services/collection-mapper.service';
import { BaseModel, BaseModelTemplate } from 'src/app/domain/models/base/base-model';
import { Ids, Collection } from 'src/app/domain/definitions/key-types';

interface DeletedModels {
    [collection: string]: number[];
}
interface ChangedModels {
    [collection: string]: BaseModel[];
}

interface UpdatePatch {
    /**
     * New data which should be applied to the existing models.
     */
    patch: ModelPatch;
    /**
     * Changed collections. The service will iterate over every collection and check if ids are removed.
     */
    changedModels: { [collection: string]: Ids };
    /**
     * Definitely deleted models.
     */
    deletedModels: { [collection: string]: Ids };
}

interface ModelPatch {
    [collection: string]: {
        [id: number]: BaseModelTemplate;
    };
}

@Injectable({
    providedIn: 'root'
})
export class ViewModelStoreUpdateService {
    public constructor(
        private DS: DataStoreService,
        private DSUpdateService: DataStoreUpdateManagerService,
        private collectionMapper: CollectionMapperService
    ) {}

    public async triggerUpdate({ changedModels, deletedModels, patch }: UpdatePatch): Promise<void> {
        const _deletedModels: DeletedModels = {};
        const _changedModels: ChangedModels = {};

        for (const collection of Object.keys(deletedModels)) {
            _deletedModels[collection] = (_deletedModels[collection] || []).concat(deletedModels[collection]);
        }

        for (const collection of Object.keys(changedModels)) {
            const modelIds = this.DS.getIdsFor(collection);
            const ids = modelIds.difference(changedModels[collection]);
            _deletedModels[collection] = (_deletedModels[collection] || []).concat(ids);
        }

        for (const collection of Object.keys(patch)) {
            _changedModels[collection] = this.createCollectionUpdate(collection, patch);
        }

        await this.doCollectionUpdates(_changedModels, _deletedModels);
    }

    private createCollectionUpdate(collection: Collection, modelData: ModelPatch): BaseModel<any>[] {
        const update: BaseModel<any>[] = [];
        for (const id of Object.keys(modelData[collection])) {
            const model = modelData[collection][+id];
            // Important: our model system needs to have an id in the model, even if it is partial
            model['id'] = +id;
            const basemodel = this.mapObjectToBaseModel(collection, model);
            if (basemodel) {
                update.push(basemodel);
            }
        }
        return update;
    }

    private async doCollectionUpdates(changedModels: ChangedModels, deletedModels: DeletedModels): Promise<void> {
        const updateSlot = await this.DSUpdateService.getNewUpdateSlot(this.DS);

        // Delete the removed objects from the DataStore
        for (const collection of Object.keys(deletedModels)) {
            await this.DS.remove(collection, deletedModels[collection]);
        }

        // Add the objects to the DataStore.
        for (const collection of Object.keys(changedModels)) {
            await this.DS.addOrUpdate(changedModels[collection]);
        }

        this.DSUpdateService.commit(updateSlot);
    }

    /**
     * Creates a BaseModel for the given plain object. If the collection is not registered,
     * a console error will be issued and null returned.
     *
     * @param collection The collection all models have to be from.
     * @param model A model that should be mapped to a BaseModel
     * @returns A basemodel constructed from the given model.
     */
    private mapObjectToBaseModel(collection: string, model: object): BaseModel | null {
        if (this.collectionMapper.isCollectionRegistered(collection)) {
            const targetClass = this.collectionMapper.getModelConstructor(collection);
            if (targetClass) {
                return new targetClass(model);
            }
            return null;
        } else {
            console.error(`Unregistered collection "${collection}". Ignore it.`);
            return null;
        }
    }
}