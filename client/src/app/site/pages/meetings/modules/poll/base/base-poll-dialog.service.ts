import { Injectable } from '@angular/core';
import { PollServiceModule } from '../services/poll-service.module';
import { PollControllerService } from 'src/app/site/pages/meetings/modules/poll/services/poll-controller.service';
import { MatDialog } from '@angular/material/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { mediumDialogSettings } from 'src/app/infrastructure/utils/dialog-settings';
import { PollDialogData, PollDialogResult } from 'src/app/site/pages/meetings/modules/poll/definitions';
import { ViewPoll } from 'src/app/site/pages/meetings/pages/polls';
import { BaseViewModel } from 'src/app/site/base/base-view-model';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: PollServiceModule })
export abstract class BasePollDialogService<V extends BaseViewModel, C = any> {
    public constructor(private controller: PollControllerService, private dialogService: MatDialog) {}

    public async open(data: Partial<PollDialogData> | ViewPoll<V>): Promise<void> {
        const dialogRef = this.dialogService.open<C, Partial<PollDialogData> | ViewPoll<V>, PollDialogResult>(
            this.getComponent(),
            {
                ...mediumDialogSettings,
                data
            }
        );
        const result = await firstValueFrom(dialogRef.afterClosed());
        if (result) {
            if (data instanceof ViewPoll) {
                this.update(result, data);
            } else {
                this.create(result);
            }
        }
    }

    protected async create(payload: any): Promise<void> {
        await this.controller.create(payload);
    }

    protected async update(payload: any, poll: ViewPoll): Promise<void> {
        await this.controller.update(payload, poll);
    }

    protected abstract getComponent(): ComponentType<C>;
}