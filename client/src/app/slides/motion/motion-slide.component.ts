import { Component, Input, ViewEncapsulation } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MotionChangeRecommendationRepositoryService } from 'app/core/repositories/motions/motion-change-recommendation-repository.service';
import { MotionLineNumberingService } from 'app/core/repositories/motions/motion-line-numbering.service';
import { MotionRepositoryService } from 'app/core/repositories/motions/motion-repository.service';
import { DiffLinesInParagraph, DiffService, LineRange } from 'app/core/ui-services/diff.service';
import { LineNumberedString, LinenumberingService } from 'app/core/ui-services/linenumbering.service';
import { SlideData } from 'app/core/ui-services/projector.service';
import { ViewUnifiedChange, ViewUnifiedChangeType } from 'app/shared/models/motions/view-unified-change';
import { ChangeRecoMode, LineNumberingMode } from 'app/site/motions/motions.constants';
import { MotionFormatService } from 'app/site/motions/services/motion-format.service';
import { IBaseScaleScrollSlideComponent } from 'app/slides/base-scale-scroll-slide-component';

import { BaseMotionSlideComponent } from '../motion-base/base-motion-slide';
import { AmendmentParagraphUnifiedChange } from './amendment-paragraph-unified-change';
import { ChangeRecommendationUnifiedChange } from './change-recommendation-unified-change';
import { AmendmentData, MotionSlideData } from './motion-slide-data';

@Component({
    selector: `os-motion-slide`,
    templateUrl: `./motion-slide.component.html`,
    styleUrls: [`./motion-slide.component.scss`],
    encapsulation: ViewEncapsulation.None
})
export class MotionSlideComponent
    extends BaseMotionSlideComponent<MotionSlideData>
    implements IBaseScaleScrollSlideComponent<MotionSlideData>
{
    /**
     * Indicates the LineNumberingMode Mode.
     */
    public lnMode: LineNumberingMode;

    /**
     * Indicates the Change reco Mode.
     */
    public crMode: ChangeRecoMode;

    /**
     * Indicates the maximum line length as defined in the configuration.
     */
    public lineLength: number;

    /**
     * Indicates the currently highlighted line, if any.
     * @TODO Read value from the backend
     */
    public highlightedLine: number;

    /**
     * Value of the config variable `motions_preamble`
     */
    public preamble: string;

    /**
     * All change recommendations AND amendments, sorted by line number.
     */
    private allChangingObjects: ViewUnifiedChange[];

    /**
     * The formatted motion text ready to display
     */
    public formattedMotionTextPlain: string | null = null;

    /**
     * Reference to all referencing motions to store sorted by `number`.
     */
    public referencingMotions = [];

    public get showMetaTable(): boolean {
        return (
            !this.data.data.show_sidebox &&
            (this.data.data?.submitters.length > 0 ||
                (!!this.data.data.recommendation_label && !!this.data.data.recommender) ||
                !!this.data.data.recommendation_referencing_motions)
        );
    }

    private _scroll = 0;

    @Input()
    public set scroll(value: number) {
        this._scroll = value;

        value *= -100;
        value += 40;
        this.textDivStyles[`margin-top`] = `${value}px`;
    }

    public get scroll(): number {
        return this._scroll;
    }

    private _scale = 0;

    @Input()
    public set scale(value: number) {
        this._scale = value;

        value *= 10;
        value += 100;
        this.textDivStyles[`font-size`] = `${value}%`;
    }

    public get scale(): number {
        return this._scale;
    }

    public get recommender(): string {
        return this.data.data.recommender;
    }

    public get recommendationLabel(): string {
        let recommendation = this.translate.instant(this.data.data.recommendation_label);
        if (this.data.data.recommendation_extension) {
            recommendation +=
                ` ` +
                this.replaceReferencedMotions(
                    this.data.data.recommendation_extension,
                    this.data.data.recommendation_referenced_motions
                );
        }
        return recommendation;
    }

    public textDivStyles: {
        width?: string;
        'margin-top'?: string;
        'font-size'?: string;
    } = {};

    public constructor(
        translate: TranslateService,
        motionRepo: MotionRepositoryService,
        private motionLineNumbering: MotionLineNumberingService,
        private motionFormatService: MotionFormatService,
        private changeRepo: MotionChangeRecommendationRepositoryService,
        private lineNumbering: LinenumberingService,
        private diff: DiffService
    ) {
        super(translate, motionRepo);
    }

    protected setData(value: SlideData<MotionSlideData>): void {
        super.setData(value);
        this.lnMode = value.data.line_numbering;
        this.lineLength = value.data.line_length;
        this.preamble = value.data.preamble;
        this.crMode = value.options.mode || `original`;

        this.textDivStyles.width = value.data.show_sidebox ? `calc(100% - 250px)` : `100%`;

        if (value.data.recommendation_referencing_motions) {
            this.referencingMotions = value.data.recommendation_referencing_motions.sort((a, b) =>
                a.number.localeCompare(b.number)
            );
        }

        this.recalcUnifiedChanges();
        this.recalcMotionText();
    }

    /**
     * Returns all paragraphs that are affected by the given amendment as unified change objects.
     *
     * @param {AmendmentData} amendment
     * @returns {AmendmentParagraphUnifiedChange[]}
     */
    public getAmendmentAmendedParagraphs(amendment: AmendmentData): AmendmentParagraphUnifiedChange[] {
        if (!amendment.amendment_paragraphs) {
            return [];
        }

        let baseHtml = this.data.data.text;
        baseHtml = this.lineNumbering.insertLineNumbers(baseHtml, this.lineLength);
        const baseParagraphs = this.lineNumbering.splitToParagraphs(baseHtml);

        const paragraphNumbers = Object.keys(amendment.amendment_paragraphs)
            .map(x => +x)
            .sort();

        return paragraphNumbers
            .map(paraNo => {
                const origText = baseParagraphs[paraNo];
                const diff = this.diff.diff(origText, amendment.amendment_paragraphs[paraNo]);
                const affectedLines = this.diff.detectAffectedLineRange(diff);

                if (affectedLines === null) {
                    return null;
                }

                const affectedDiff = this.diff.formatDiff(
                    this.diff.extractRangeByLineNumbers(diff, affectedLines.from, affectedLines.to)
                );
                const affectedConsolidated = this.diff.diffHtmlToFinalText(affectedDiff);

                return new AmendmentParagraphUnifiedChange(amendment, paraNo, affectedConsolidated, affectedLines);
            })
            .filter(x => x !== null);
    }

    /**
     * Merges amendments and change recommendations and sorts them by the line numbers.
     * Called each time one of these arrays changes.
     */
    private recalcUnifiedChanges(): void {
        this.allChangingObjects = [];

        if (this.data.data.change_recommendations) {
            this.data.data.change_recommendations.forEach(change => {
                this.allChangingObjects.push(new ChangeRecommendationUnifiedChange(change));
            });
        }
        if (this.data.data.amendments) {
            this.data.data.amendments.forEach(amendment => {
                if (amendment.change_recommendations?.length) {
                    const amendmentCRs = amendment.change_recommendations.map(
                        cr => new ChangeRecommendationUnifiedChange(cr)
                    );
                    this.allChangingObjects.push(...amendmentCRs);
                } else {
                    const paras = this.getAmendmentAmendedParagraphs(amendment);
                    this.allChangingObjects.push(...paras);
                }
            });
        }
        this.allChangingObjects.sort((a: ViewUnifiedChange, b: ViewUnifiedChange) => {
            if (a.getLineFrom() < b.getLineFrom()) {
                return -1;
            } else if (a.getLineFrom() > b.getLineFrom()) {
                return 1;
            } else {
                return 0;
            }
        });
    }

    private recalcMotionText(): void {
        const changes = this.crMode === ChangeRecoMode.Original ? [] : this.getAllTextChangingObjects();
        this.formattedMotionTextPlain = this.motionFormatService.formatMotion(
            this.data.data,
            this.crMode,
            changes,
            this.lineLength,
            this.highlightedLine
        );
    }

    /**
     * Returns true, if this is a statute amendment
     *
     * @returns {boolean}
     */
    public isStatuteAmendment(): boolean {
        return !!this.data.data.base_statute;
    }

    /**
     * Returns true, if this is an paragraph-based amendment
     *
     * @returns {boolean}
     */
    public isParagraphBasedAmendment(): boolean {
        return !!this.data.data.lead_motion;
    }

    /**
     * Returns true if no line numbers are to be shown.
     *
     * @returns whether there are line numbers at all
     */
    public isLineNumberingNone(): boolean {
        return this.lnMode === LineNumberingMode.None;
    }

    /**
     * Returns true if the line numbers are to be shown within the text with no line breaks.
     *
     * @returns whether the line numberings are inside
     */
    public isLineNumberingInline(): boolean {
        return this.lnMode === LineNumberingMode.Inside;
    }

    /**
     * Returns true if the line numbers are to be shown to the left of the text.
     *
     * @returns whether the line numberings are outside
     */
    public isLineNumberingOutside(): boolean {
        return this.lnMode === LineNumberingMode.Outside;
    }

    /**
     * Extracts a renderable HTML string representing the given line number range of this motion
     *
     * @param {LineNumberedString} motionHtml
     * @param {LineRange} lineRange
     * @param {boolean} lineNumbers - weather to add line numbers to the returned HTML string
     * @param {number} lineLength
     */
    public extractMotionLineRange(
        motionHtml: LineNumberedString,
        lineRange: LineRange,
        lineNumbers: boolean,
        lineLength: number
    ): string {
        const extracted = this.diff.extractRangeByLineNumbers(motionHtml, lineRange.from, lineRange.to);
        let html =
            extracted.outerContextStart +
            extracted.innerContextStart +
            extracted.html +
            extracted.innerContextEnd +
            extracted.outerContextEnd;
        if (lineNumbers) {
            html = this.lineNumbering.insertLineNumbers(html, lineLength, null, null, lineRange.from);
        }
        return html;
    }

    public getAllTextChangingObjects(): ViewUnifiedChange[] {
        return this.allChangingObjects.filter((obj: ViewUnifiedChange) => !obj.isTitleChange());
    }

    public getTitleChangingObject(): ViewUnifiedChange {
        return this.allChangingObjects.find((obj: ViewUnifiedChange) => obj.isTitleChange());
    }

    public getTitleWithChanges(): string {
        return this.changeRepo.getTitleWithChanges(this.data.data.title, this.getTitleChangingObject(), this.crMode);
    }

    public getFormattedTitleDiff(): string {
        const change = this.getTitleChangingObject();
        return this.changeRepo.getTitleChangesAsDiff(this.data.data.title, change);
    }

    /**
     * If `this.data.data` is an amendment, this returns the list of all changed paragraphs.
     *
     * @returns {DiffLinesInParagraph[]}
     */
    public getAmendedParagraphs(): DiffLinesInParagraph[] {
        const motion = this.data.data;
        if (!motion.amendment_paragraphs) {
            return [];
        }

        const baseHtml = this.lineNumbering.insertLineNumbers(motion.lead_motion?.text, this.lineLength);
        const baseParagraphs = this.lineNumbering.splitToParagraphs(baseHtml);

        const paragraphNumbers = Object.keys(motion.amendment_paragraphs)
            .map(x => +x)
            .sort();
        const amendmentParagraphs = paragraphNumbers
            .map(paraNo =>
                this.diff.getAmendmentParagraphsLines(
                    paraNo,
                    baseParagraphs[paraNo],
                    motion.amendment_paragraphs[paraNo.toString()],
                    this.lineLength,
                    this.crMode === ChangeRecoMode.Diff ? this.getAllTextChangingObjects() : undefined
                )
            )
            .filter((para: DiffLinesInParagraph) => para !== null);

        return amendmentParagraphs;
    }

    /**
     * get the diff html from the statute amendment, as SafeHTML for [innerHTML]
     *
     * @returns safe html strings
     */
    public getFormattedStatuteAmendment(): string {
        const diffHtml = this.diff.diff(this.data.data.base_statute.text, this.data.data.text);
        return this.lineNumbering.insertLineBreaksWithoutNumbers(diffHtml, this.lineLength, true);
    }

    /**
     * Returns true if this change is colliding with another change
     * @param {ViewUnifiedChange} change
     * @param {ViewUnifiedChange[]} changes
     */
    public hasCollissions(change: ViewUnifiedChange, changes: ViewUnifiedChange[]): boolean {
        return this.motionLineNumbering.changeHasCollissions(change, changes);
    }

    /**
     * Returns true if the change is an Amendment
     *
     * @param {ViewUnifiedChange} change
     */
    public isAmendment(change: ViewUnifiedChange): boolean {
        return change.getChangeType() === ViewUnifiedChangeType.TYPE_AMENDMENT;
    }

    /**
     * Returns true if the change is a Change Recommendation
     *
     * @param {ViewUnifiedChange} change
     */
    public isChangeRecommendation(change: ViewUnifiedChange): boolean {
        return change.getChangeType() === ViewUnifiedChangeType.TYPE_CHANGE_RECOMMENDATION;
    }

    /**
     * Returns the diff string from the motion to the change
     * @param {ViewUnifiedChange} change
     */
    public getAmendmentDiff(change: ViewUnifiedChange): string {
        const motion = this.data.data;
        const baseHtml = this.lineNumbering.insertLineNumbers(motion.lead_motion?.text, this.lineLength);

        return this.diff.getChangeDiff(baseHtml, change, this.lineLength, this.highlightedLine);
    }
}
