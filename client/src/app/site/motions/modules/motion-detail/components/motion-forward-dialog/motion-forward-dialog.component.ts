import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { BehaviorSubject, Observable } from 'rxjs';

import { ActiveMeetingService } from 'app/core/core-services/active-meeting.service';
import { HttpService } from 'app/core/core-services/http.service';
import { Id } from 'app/core/definitions/key-types';
import { MatCheckboxChange } from '@angular/material/checkbox';

interface PresenterMeeting {
    id: Id;
    name: string;
}

interface ForwardingPresenter {
    id: Id;
    name: string;
    default_meeting_id?: Id;
    meetings?: PresenterMeeting[];
}

type ForwardingPresenterResult = ForwardingPresenter[][];

@Component({
    selector: 'os-motion-forward-dialog',
    templateUrl: './motion-forward-dialog.component.html',
    styleUrls: ['./motion-forward-dialog.component.scss']
})
export class MotionForwardDialogComponent implements OnInit {
    public get committeesObservable(): Observable<ForwardingPresenter[]> {
        return this.committeesSubject.asObservable();
    }

    public readonly checkboxStateMap: { [id: string]: boolean } = {};
    public selectedMeetings: Set<Id>;

    private readonly committeesSubject = new BehaviorSubject<ForwardingPresenter[]>([]);

    public constructor(
        private dialogRef: MatDialogRef<MotionForwardDialogComponent, Id[]>,
        private http: HttpService,
        private activeMeeting: ActiveMeetingService
    ) {}

    public async ngOnInit(): Promise<void> {
        const payload = [
            {
                presenter: 'get_forwarding_meetings',
                data: {
                    meeting_id: this.activeMeeting.meetingId
                }
            }
        ];
        const result = await this.http.post<ForwardingPresenterResult>('/system/presenter/handle_request', payload);
        this.committeesSubject.next(result[0]);
        this.selectedMeetings = new Set(this.getDefaultMeetingsIds());
        this.initStateMap();
    }

    public onSaveClicked(): void {
        this.dialogRef.close(Array.from(this.selectedMeetings));
    }

    public onChangeCheckbox({ source, checked }: MatCheckboxChange): void {
        const fn = checked ? 'add' : 'delete';
        this.selectedMeetings[fn](+source.value);
    }

    public isDefaultMeetingFor(meeting: PresenterMeeting, committee: ForwardingPresenter): boolean {
        return meeting.id === committee.default_meeting_id;
    }

    public isActiveMeeting(meeting: PresenterMeeting): boolean {
        return meeting.id === this.activeMeeting.meetingId;
    }

    private initStateMap(): void {
        const meetings = this.committeesSubject.value.flatMap(committee => committee.meetings);
        for (const meeting of meetings) {
            this.checkboxStateMap[meeting.id] = this.selectedMeetings.has(meeting.id);
        }
    }

    private getDefaultMeetingsIds(): Id[] {
        const committees = this.committeesSubject.value;
        return committees
            .filter(
                committee =>
                    committee.default_meeting_id && committee.default_meeting_id !== this.activeMeeting.meetingId
            )
            .map(committee => committee.default_meeting_id);
    }
}
