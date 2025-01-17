import { Id } from 'src/app/domain/definitions/key-types';
import { FULL_FIELDSET, MEETING_ROUTING_FIELDS } from 'src/app/domain/fieldsets/misc';
import { MeetingUserFieldsets, UserFieldsets } from 'src/app/domain/fieldsets/user';
import { SubscriptionConfigGenerator } from 'src/app/domain/interfaces/subscription-config';
import { ViewMeeting } from 'src/app/site/pages/meetings/view-models/view-meeting';
import { FollowList } from 'src/app/site/services/model-request-builder';

import { pollModelRequest } from '../polls/polls.subscription';
import { ViewListOfSpeakers, ViewTopic } from './modules';

export const AGENDA_LIST_ITEM_SUBSCRIPTION = `agenda_list`;
export const AGENDA_LIST_ITEM_MINIMAL_SUBSCRIPTION = `agenda_list_minimal`;
export const TOPIC_ITEM_SUBSCRIPTION = `topic_detail`;
export const TOPIC_ITEM_DUPLICATE_SUBSCRIPTION = `topic_detail`;
export const LIST_OF_SPEAKERS_SUBSCRIPTION = `los_detail`;

export const agendaItemFollow: FollowList<any> = [
    {
        idField: `list_of_speakers_id`,
        fieldset: [`closed`, ...MEETING_ROUTING_FIELDS],
        follow: [
            {
                idField: `speaker_ids`,
                fieldset: FULL_FIELDSET,
                follow: [
                    { idField: `meeting_user_id`, ...MeetingUserFieldsets.FullNameSubscription },
                    {
                        idField: `point_of_order_category_id`,
                        fieldset: FULL_FIELDSET
                    }
                ]
            }
        ]
    },
    {
        idField: `poll_ids`,
        ...pollModelRequest
    }
];

export const getAgendaListSubscriptionConfig: SubscriptionConfigGenerator = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        ids: [id],
        follow: [
            {
                idField: `agenda_item_ids`,
                fieldset: FULL_FIELDSET,
                follow: [
                    {
                        idField: `content_object_id`,
                        fieldset: [`number`, `title`, `agenda_item_id`, ...MEETING_ROUTING_FIELDS],
                        follow: [
                            {
                                idField: `list_of_speakers_id`,
                                ...listOfSpeakersSpeakerCountSubscription
                            },
                            {
                                idField: `submitter_ids`,
                                fieldset: FULL_FIELDSET,
                                follow: [{ idField: `meeting_user_id`, ...MeetingUserFieldsets.FullNameSubscription }]
                            }
                        ]
                    }
                ]
            },
            { idField: `tag_ids`, fieldset: [`name`, `meeting_id`] }
        ]
    },
    subscriptionName: AGENDA_LIST_ITEM_SUBSCRIPTION
});

export const getAgendaListMinimalSubscriptionConfig: SubscriptionConfigGenerator = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        ids: [id],
        follow: [
            {
                idField: `agenda_item_ids`,
                fieldset: FULL_FIELDSET,
                follow: [
                    {
                        idField: `content_object_id`,
                        fieldset: [`title`, `number`, ...MEETING_ROUTING_FIELDS]
                    }
                ]
            }
        ]
    },
    subscriptionName: AGENDA_LIST_ITEM_MINIMAL_SUBSCRIPTION
});

export const getTopicDetailSubscriptionConfig: SubscriptionConfigGenerator = (...ids: Id[]) => ({
    modelRequest: {
        viewModelCtor: ViewTopic,
        ids,
        fieldset: FULL_FIELDSET,
        follow: [
            {
                idField: `attachment_meeting_mediafile_ids`,
                follow: [{ idField: `mediafile_id`, fieldset: FULL_FIELDSET }]
            },
            {
                idField: `poll_ids`,
                ...pollModelRequest
            },
            {
                idField: `list_of_speakers_id`,
                fieldset: FULL_FIELDSET
            },
            { idField: `agenda_item_id`, fieldset: [`item_number`, `content_object_id`] }
        ]
    },
    subscriptionName: TOPIC_ITEM_SUBSCRIPTION
});

export const getTopicDuplicateSubscriptionConfig: SubscriptionConfigGenerator = (...ids: Id[]) => ({
    modelRequest: {
        viewModelCtor: ViewTopic,
        ids,
        fieldset: FULL_FIELDSET
    },
    subscriptionName: TOPIC_ITEM_DUPLICATE_SUBSCRIPTION
});

export const listOfSpeakersSpeakerCountSubscription = {
    fieldset: [`closed`, ...MEETING_ROUTING_FIELDS],
    follow: [
        {
            idField: `speaker_ids`,
            follow: [
                {
                    idField: `point_of_order_category_id`,
                    fieldset: FULL_FIELDSET
                }
            ],
            fieldset: [`begin_time`, `end_time`]
        }
    ]
};

export const getListOfSpeakersDetailSubscriptionConfig: SubscriptionConfigGenerator = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewListOfSpeakers,
        ids: [id],
        fieldset: FULL_FIELDSET,
        follow: [
            {
                idField: `speaker_ids`,
                fieldset: FULL_FIELDSET,
                follow: [
                    {
                        idField: `meeting_user_id`,
                        follow: [
                            { idField: `user_id`, ...UserFieldsets.FullNameSubscription },
                            { idField: `structure_level_ids`, fieldset: [`name`] }
                        ],
                        fieldset: [`number`, `vote_weight`]
                    },
                    {
                        idField: `structure_level_list_of_speakers_id`,
                        fieldset: FULL_FIELDSET
                    },
                    {
                        idField: `point_of_order_category_id`,
                        fieldset: FULL_FIELDSET
                    }
                ]
            },
            {
                idField: `structure_level_list_of_speakers_ids`,
                fieldset: FULL_FIELDSET,
                follow: [
                    {
                        idField: `structure_level_id`,
                        fieldset: [`name`, `color`]
                    }
                ]
            }
        ]
    },
    subscriptionName: LIST_OF_SPEAKERS_SUBSCRIPTION
});
