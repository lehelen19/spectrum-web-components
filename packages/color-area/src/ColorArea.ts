/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import {
    CSSResultArray,
    html,
    PropertyValues,
    SpectrumElement,
    TemplateResult,
} from '@spectrum-web-components/base';
import {
    ifDefined,
    styleMap,
} from '@spectrum-web-components/base/src/directives.js';
import {
    property,
    query,
} from '@spectrum-web-components/base/src/decorators.js';
import { streamingListener } from '@spectrum-web-components/base/src/streaming-listener.js';
import { SWCResizeObserverEntry, WithSWCResizeObserver } from './types';
import type { ColorHandle } from '@spectrum-web-components/color-handle';
import '@spectrum-web-components/color-handle/sp-color-handle.js';
import {
    ColorController,
    ColorValue,
} from '@spectrum-web-components/reactive-controllers/src/Color.js';
import { LanguageResolutionController } from '@spectrum-web-components/reactive-controllers/src/LanguageResolution.js';
import {
    isAndroid,
    isIOS,
} from '@spectrum-web-components/shared/src/platform.js';

import styles from './color-area.css.js';

/**
 * @element sp-color-area
 * @slot gradient - a custom gradient visually outlining the available color values
 * @fires input - The value of the Color Area has changed.
 * @fires change - An alteration to the value of the Color Area has been committed by the user.
 */
export class ColorArea extends SpectrumElement {
    public static override get styles(): CSSResultArray {
        return [styles];
    }

    @property({ type: String, reflect: true })
    public override dir!: 'ltr' | 'rtl';

    @property({ type: Boolean, reflect: true })
    public disabled = false;

    @property({ type: Boolean, reflect: true })
    public focused = false;

    @property({ type: String, attribute: 'label-x' })
    public labelX = 'saturation';

    @property({ type: String, attribute: 'label-y' })
    public labelY = 'luminosity';

    @query('.handle')
    private handle!: ColorHandle;

    private languageResolver = new LanguageResolutionController(this);

    private colorController = new ColorController(this, {
        extractColorFromState: () => ({
            h: this.hue,
            s: this.x,
            v: this.y,
        }),
        applyColorToState: ({ s, v }) => {
            this._x = s;
            this._y = v;
            this.requestUpdate();
        },
    });

    @property({ type: Number })
    public get hue(): number {
        return this.colorController.hue;
    }

    public set hue(value: number) {
        this.colorController.hue = value;
    }

    @property({ type: String })
    public get value(): ColorValue {
        return this.colorController.color;
    }

    @property({ type: String })
    public get color(): ColorValue {
        return this.colorController.color;
    }

    public set color(color: ColorValue) {
        this.colorController.color = color;
    }

    @property({ attribute: false })
    private activeAxis = 'x';

    @property({ type: Number })
    public get x(): number {
        return this._x;
    }

    public set x(x: number) {
        if (x === this.x) {
            return;
        }
        const oldValue = this.x;
        this._x = x;
        if (this.inputX) {
            // Use the native `input[type='range']` control to validate this value after `firstUpdate`
            this.inputX.value = x.toString();
            this._x = this.inputX.valueAsNumber;
        }
        this.requestUpdate('x', oldValue);
        this.colorController.applyColorFromState();
    }

    private _x = 1;

    @property({ type: Number })
    public get y(): number {
        return this._y;
    }

    public set y(y: number) {
        if (y === this.y) {
            return;
        }
        const oldValue = this.y;
        this._y = y;
        if (this.inputY) {
            // Use the native `input[type='range']` control to validate this value after `firstUpdate`
            this.inputY.value = y.toString();
            this._y = this.inputY.valueAsNumber;
        }
        this.requestUpdate('y', oldValue);
        this.colorController.applyColorFromState();
    }

    private _y = 1;

    @property({ type: Number })
    public step = 0.01;

    @query('[name="x"]')
    public inputX!: HTMLInputElement;

    @query('[name="y"]')
    public inputY!: HTMLInputElement;

    private altered = 0;

    private activeKeys = new Set();

    private _valueChanged = false;

    public override focus(focusOptions: FocusOptions = {}): void {
        super.focus(focusOptions);
        this.forwardFocus();
    }

    private forwardFocus(): void {
        this.focused = this.hasVisibleFocusInTree();
        if (this.activeAxis === 'x') {
            this.inputX.focus();
        } else {
            this.inputY.focus();
        }
    }

    private handleFocus(): void {
        this.focused = true;
        this._valueChanged = false;
    }

    public handleBlur(): void {
        if (this._pointerDown) {
            return;
        }
        this.altered = 0;
        this.focused = false;
        this._valueChanged = false;
    }

    private handleKeydown(event: KeyboardEvent): void {
        const { code } = event;
        this.focused = true;
        this.altered = [event.shiftKey, event.ctrlKey, event.altKey].filter(
            (key) => !!key
        ).length;
        const isArrowKey =
            code.search('Arrow') === 0 ||
            code.search('Page') === 0 ||
            code.search('Home') === 0 ||
            code.search('End') === 0;
        if (isArrowKey) {
            event.preventDefault();
            this.activeKeys.add(code);
            this.handleKeypress();
        }
    }

    private handleKeypress(): void {
        let deltaX = 0;
        let deltaY = 0;
        const step = Math.max(this.step, this.altered * 5 * this.step);
        this.activeKeys.forEach((code) => {
            switch (code) {
                case 'ArrowUp':
                    deltaY = step;
                    break;
                case 'ArrowDown':
                    deltaY = step * -1;
                    break;
                case 'ArrowLeft':
                    deltaX = this.step * (this.isLTR ? -1 : 1);
                    break;
                case 'ArrowRight':
                    deltaX = this.step * (this.isLTR ? 1 : -1);
                    break;
                case 'PageUp':
                    deltaY = step * 10;
                    break;
                case 'PageDown':
                    deltaY = step * -10;
                    break;
                case 'Home':
                    deltaX = step * (this.isLTR ? -10 : 10);
                    break;
                case 'End':
                    deltaX = step * (this.isLTR ? 10 : -10);
                    break;
                /* c8 ignore next 2 */
                default:
                    break;
            }
        });
        if (deltaX != 0) {
            this.activeAxis = 'x';
            this.inputX.focus();
        } else if (deltaY != 0) {
            this.activeAxis = 'y';
            this.inputY.focus();
        }
        this.x = Math.min(1, Math.max(this.x + deltaX, 0));
        this.y = Math.min(1, Math.max(this.y + deltaY, 0));

        this.colorController.savePreviousColor();
        this.colorController.applyColorFromState();

        if (deltaX != 0 || deltaY != 0) {
            this._valueChanged = true;
            this.dispatchEvent(
                new Event('input', {
                    bubbles: true,
                    composed: true,
                })
            );
            const applyDefault = this.dispatchEvent(
                new Event('change', {
                    bubbles: true,
                    composed: true,
                    cancelable: true,
                })
            );
            if (!applyDefault) {
                this.colorController.restorePreviousColor();
            }
        }
    }

    private handleKeyup(event: KeyboardEvent): void {
        event.preventDefault();
        const { code } = event;
        this.activeKeys.delete(code);
    }

    private handleInput(event: Event & { target: HTMLInputElement }): void {
        const { valueAsNumber, name } = event.target;

        this[name as 'x' | 'y'] = valueAsNumber;
        this.colorController.applyColorFromState();
    }

    private handleChange(event: Event & { target: HTMLInputElement }): void {
        this.handleInput(event);
        this.dispatchEvent(
            new Event('change', {
                bubbles: true,
                composed: true,
                cancelable: true,
            })
        );
    }

    private boundingClientRect!: DOMRect;
    public _pointerDown = false;

    private handlePointerdown(event: PointerEvent): void {
        if (event.button !== 0) {
            event.preventDefault();
            return;
        }
        this._pointerDown = true;
        this.colorController.savePreviousColor();
        this.boundingClientRect = this.getBoundingClientRect();
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        if (event.pointerType === 'mouse') {
            this.focused = true;
        }
    }

    private handlePointermove(event: PointerEvent): void {
        const [x, y] = this.calculateHandlePosition(event);

        this._valueChanged = false;

        this.x = x;
        this.y = 1 - y;
        this.colorController.applyColorFromState();
        this.dispatchEvent(
            new Event('input', {
                bubbles: true,
                composed: true,
                cancelable: true,
            })
        );
    }

    private handlePointerup(event: PointerEvent): void {
        event.preventDefault();
        this._pointerDown = false;
        (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        const applyDefault = this.dispatchEvent(
            new Event('change', {
                bubbles: true,
                composed: true,
                cancelable: true,
            })
        );
        this.inputX.focus();
        if (event.pointerType === 'mouse') {
            this.focused = false;
        }
        if (!applyDefault) {
            this.colorController.restorePreviousColor();
        }
    }

    /**
     * Returns the value under the cursor
     * @param: PointerEvent on slider
     * @return: Slider value that correlates to the position under the pointer
     */
    private calculateHandlePosition(event: PointerEvent): [number, number] {
        /* c8 ignore next 3 */
        if (!this.boundingClientRect) {
            return [this.x, this.y];
        }
        const rect = this.boundingClientRect;
        const minOffsetX = rect.left;
        const minOffsetY = rect.top;
        const offsetX = event.clientX;
        const offsetY = event.clientY;
        const width = rect.width;
        const height = rect.height;

        const percentX = Math.max(
            0,
            Math.min(1, (offsetX - minOffsetX) / width)
        );
        const percentY = Math.max(
            0,
            Math.min(1, (offsetY - minOffsetY) / height)
        );

        return [this.isLTR ? percentX : 1 - percentX, percentY];
    }

    private handleAreaPointerdown(event: PointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        event.stopPropagation();
        event.preventDefault();
        this.handle.dispatchEvent(new PointerEvent('pointerdown', event));
        this.handlePointermove(event);
    }

    protected override render(): TemplateResult {
        const { width = 0, height = 0 } = this.boundingClientRect || {};

        const isMobile = isAndroid() || isIOS();
        const defaultAriaLabel = 'Color Picker';
        const ariaLabel = defaultAriaLabel;
        const ariaRoleDescription = ifDefined(
            isMobile ? undefined : '2d slider'
        );

        const ariaLabelX = this.labelX;
        const ariaLabelY = this.labelY;
        const ariaValueX = new Intl.NumberFormat(
            this.languageResolver.language,
            {
                style: 'percent',
                unitDisplay: 'narrow',
            }
        ).format(this.x);
        const ariaValueY = new Intl.NumberFormat(
            this.languageResolver.language,
            {
                style: 'percent',
                unitDisplay: 'narrow',
            }
        ).format(this.y);

        const style = {
            background: `linear-gradient(to top, black 0%, hsla(${this.hue}, 100%, 0.01%, 0) 100%),linear-gradient(to right, white 0%, hsla(${this.hue}, 100%, 0.01%, 0) 100%), hsl(${this.hue}, 100%, 50%);`,
        };

        return html`
            <div
                @pointerdown=${this.handleAreaPointerdown}
                class="gradient"
                style=${styleMap(style)}
            >
                <slot name="gradient"></slot>
            </div>

            <sp-color-handle
                tabindex=${ifDefined(this.focused ? undefined : '0')}
                @focus=${this.forwardFocus}
                ?focused=${this.focused}
                class="handle"
                color=${this.colorController.getHslString()}
                ?disabled=${this.disabled}
                style=${`transform: translate(${
                    (this.isLTR ? this.x : 1 - this.x) * width
                }px, ${height - this.y * height}px);`}
                ${streamingListener({
                    start: ['pointerdown', this.handlePointerdown],
                    streamInside: ['pointermove', this.handlePointermove],
                    end: [
                        ['pointerup', 'pointercancel', 'pointerleave'],
                        this.handlePointerup,
                    ],
                })}
            ></sp-color-handle>

            <fieldset
                class="fieldset"
                aria-label=${ifDefined(isMobile ? ariaLabel : undefined)}
            >
                <div role="presentation">
                    <input
                        type="range"
                        class="slider"
                        name="x"
                        aria-label=${isMobile
                            ? ariaLabelX
                            : `${ariaLabelX} ${ariaLabel}`}
                        aria-roledescription=${ariaRoleDescription}
                        aria-orientation="horizontal"
                        aria-valuetext=${isMobile
                            ? ariaValueX
                            : `${ariaValueX}, ${ariaLabelX}${
                                  this._valueChanged
                                      ? ''
                                      : `, ${ariaValueY}, ${ariaLabelY}`
                              }`}
                        min="0"
                        max="1"
                        step=${this.step}
                        tabindex="-1"
                        .value=${String(this.x)}
                        @input=${this.handleInput}
                        @change=${this.handleChange}
                    />
                </div>
                <div role="presentation">
                    <input
                        type="range"
                        class="slider"
                        name="y"
                        aria-label=${isMobile
                            ? ariaLabelY
                            : `${ariaLabelY} ${ariaLabel}`}
                        aria-roledescription=${ariaRoleDescription}
                        aria-orientation="vertical"
                        aria-valuetext=${isMobile
                            ? ariaValueY
                            : `${ariaValueY}, ${ariaLabelY}${
                                  this._valueChanged
                                      ? ''
                                      : `, ${ariaValueX}, ${ariaLabelX}`
                              }`}
                        orient="vertical"
                        min="0"
                        max="1"
                        step=${this.step}
                        tabindex="-1"
                        .value=${String(this.y)}
                        @input=${this.handleInput}
                        @change=${this.handleChange}
                    />
                </div>
            </fieldset>
        `;
    }

    protected override firstUpdated(changed: PropertyValues): void {
        super.firstUpdated(changed);
        this.boundingClientRect = this.getBoundingClientRect();

        this.addEventListener('focus', this.handleFocus);
        this.addEventListener('blur', this.handleBlur);
        this.addEventListener('keyup', this.handleKeyup);
        this.addEventListener('keydown', this.handleKeydown);
    }

    protected override updated(changed: PropertyValues): void {
        super.updated(changed);
        if (this.x !== this.inputX.valueAsNumber) {
            this._x = this.inputX.valueAsNumber;
        }
        if (this.y !== this.inputY.valueAsNumber) {
            this._y = this.inputY.valueAsNumber;
        }
        if (changed.has('focused') && this.focused) {
            // Lazily bind the `input[type="range"]` elements in shadow roots
            // so that browsers with certain settings (Webkit) aren't allowed
            // multiple tab stops within the Color Area.
            const parentX = this.inputX.parentElement as HTMLDivElement;
            const parentY = this.inputY.parentElement as HTMLDivElement;
            if (!parentX.shadowRoot && !parentY.shadowRoot) {
                parentX.attachShadow({ mode: 'open' });
                parentY.attachShadow({ mode: 'open' });
                const slot = '<div tabindex="-1"><slot></slot></div>';
                (parentX.shadowRoot as unknown as ShadowRoot).innerHTML = slot;
                (parentY.shadowRoot as unknown as ShadowRoot).innerHTML = slot;
            }
        }
    }

    private observer?: WithSWCResizeObserver['ResizeObserver'];

    public override connectedCallback(): void {
        super.connectedCallback();
        if (
            !this.observer &&
            (window as unknown as WithSWCResizeObserver).ResizeObserver
        ) {
            this.observer = new (
                window as unknown as WithSWCResizeObserver
            ).ResizeObserver((entries: SWCResizeObserverEntry[]) => {
                for (const entry of entries) {
                    this.boundingClientRect = entry.contentRect;
                }
                this.requestUpdate();
            });
        }
        this.observer?.observe(this);
    }

    public override disconnectedCallback(): void {
        this.observer?.unobserve(this);
        super.disconnectedCallback();
    }
}
