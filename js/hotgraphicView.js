define([
    'core/js/adapt',
    'core/js/views/componentView',
    './hotgraphicPopupView'
], function(Adapt, ComponentView, HotgraphicPopupView) {
    'use strict';

    var HotGraphicView = ComponentView.extend({

        events: {
            'click .hotgraphic-graphic-pin': 'onPinClicked'
        },

        initialize: function() {
            ComponentView.prototype.initialize.call(this);
            this.setUpViewData();
            this.setUpModelData();
            this.setUpEventListeners();
            this.checkIfResetOnRevisit();
        },

        setUpViewData: function() {
            this.popupView = null;
            this._isPopupOpen = false;
        },

        setUpModelData: function() {
            if (this.model.get('_canCycleThroughPagination') === undefined) {
                this.model.set('_canCycleThroughPagination', false);
            }
        },

        setUpEventListeners: function() {
            this.listenTo(Adapt, {
                'device:changed': this.reRender,
                'device:resized': this.setupTooltips
            });

            this.listenTo(this.model.get('_children'), {
                'change:_isActive': this.onItemsActiveChange,
                'change:_isVisited': this.onItemsVisitedChange
            });
        },

        reRender: function() {
            if (Adapt.device.screenSize !== 'large') {
                this.replaceWithNarrative();
            }
        },

        replaceWithNarrative: function() {
            var NarrativeView = Adapt.getViewClass('narrative');

            var model = this.prepareNarrativeModel();
            var newNarrative = new NarrativeView({ model: model });
            var $container = $(".component-container", $("." + this.model.get("_parentId")));

            newNarrative.reRender();
            newNarrative.setupNarrative();
            $container.append(newNarrative.$el);
            Adapt.trigger('device:resize');
            _.defer(this.remove.bind(this));
        },

        prepareNarrativeModel: function() {
            var model = this.model;
            model.set({
                '_component': 'narrative',
                '_wasHotgraphic': true,
                'originalBody': model.get('body'),
                'originalInstruction': model.get('instruction')
            });

            // Check if active item exists, default to 0
            var activeItem = model.getActiveItem();
            if (!activeItem) {
                model.getItem(0).toggleActive(true);
            }

            // Swap mobile body and instructions for desktop variants.
            if (model.get('mobileBody')) {
                model.set('body', model.get('mobileBody'));
            }
            if (model.get('mobileInstruction')) {
                model.set('instruction', model.get('mobileInstruction'));
            }

            return model;
        },

        onItemsActiveChange: function(model, _isActive) {
            this.getItemElement(model).toggleClass('active', _isActive);
        },

        getItemElement: function(model) {
            var index = model.get('_index');
            return this.$('.hotgraphic-graphic-pin').filter('[data-index="' + index + '"]');
        },

        onItemsVisitedChange: function(model, _isVisited) {
            if (!_isVisited) return;
            var $pin = this.getItemElement(model);

            // Append the word 'visited.' to the pin's aria-label
            var visitedLabel = this.model.get('_globals')._accessibility._ariaLabels.visited + ".";
            $pin.attr('aria-label', function(index, val) {
                return val + " " + visitedLabel;
            });

            $pin.addClass('visited');
        },

        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        preRender: function() {
            if (Adapt.device.screenSize === 'large') {
                this.render();
            } else {
                this.reRender();
            }
        },

        postRender: function() {
            this.$('.hotgraphic-widget').imageready(function() {
                this.setReadyStatus();
                this.setupTooltips();
            }.bind(this));

            if (this.model.get('_setCompletionOn') === 'inview') {
                this.setupInviewCompletion('.component-widget');
            }
        },

        setupTooltips: function() {
            var tooltipConfig = this.model.get('_tooltips');
            if (!tooltipConfig || !tooltipConfig._isEnabled) return;

            this.model.get('_items').forEach(function(item) {
                var config = {
                    tooltipConfig: tooltipConfig,
                    tooltipElement: $(this.$('.hotgraphic-tooltip').filter('[data-index="' + item._index + '"]')[0]),
                    pinElement: $(this.$('.hotgraphic-graphic-pin').filter('[data-index="' + item._index + '"]')[0]),
                    item: item
                };
                this.setTooltipPosition(config);
                this.setTooltipEventListener(config);
            }, this);
        },

        setTooltipPosition: function(config) {
            var directionOpposites = {
                left: 'right',
                top: 'bottom',
                right: 'left',
                bottom: 'top'
            };
            var alignedPosition = this.getTooltipAlignedPosition(config);
            var oppositeAlignment = directionOpposites[config.tooltipConfig._alignment];

            if (!this.checkTooltipWithinBounds(config, alignedPosition)) {
                alignedPosition = this.getTooltipAlignedPosition(config, oppositeAlignment);
            }

            if (!this.checkTooltipWithinBounds(config, alignedPosition)) {
                alignedPosition = this.moveWithinBounds(config, alignedPosition, oppositeAlignment);
            }

            config.tooltipElement.css(alignedPosition);
        },

        moveWithinBounds: function(config, alignedPosition, alignment) {
            var parentElement = $('.hotgraphic-graphic');

            switch(alignment) {
                case 'left':
                    alignedPosition.left = 0;
                    break;
                case 'top':
                    alignedPosition.top = 0;
                    break;
                case 'right':
                    alignedPosition.left = parentElement.width() - config.tooltipElement.outerWidth();
                    break;
                case 'bottom':
                    alignedPosition.top = parentElement.height() - config.tooltipElement.outerHeight();
                    break;
            }

            return alignedPosition;
        },

        getTooltipAlignedPosition: function(config, newAlignment) {
            var alignment = newAlignment || config.tooltipConfig._alignment || 'top';
            config.tooltipElement.removeClass().addClass('hotgraphic-tooltip hotgraphic-tooltip-' + alignment);
            var centrePosition = this.getTooltipCentrePosition(config);
            var xTooltip = config.tooltipElement.outerWidth(true) / 2;
            var yTooltip = config.tooltipElement.outerHeight(true) / 2;
            var xPin = config.pinElement.outerWidth() / 2;
            var yPin = config.pinElement.outerHeight() / 2;
            var alignedPosition = {
                top: centrePosition.top,
                left: centrePosition.left
            };


            switch(alignment) {
                case 'left':
                    alignedPosition.left = centrePosition.left - xTooltip - xPin;
                    break;
                case 'top':
                    alignedPosition.top = centrePosition.top - yTooltip - yPin;
                    break;
                case 'right':
                    alignedPosition.left = centrePosition.left + xTooltip + xPin;
                    break;
                case 'bottom':
                    alignedPosition.top = centrePosition.top + yTooltip + yPin;
                    break;
            }

            return alignedPosition;
        },

        getTooltipCentrePosition: function(config) {
            var yCentre = config.pinElement.position().top + (config.pinElement.outerHeight() / 2);
            var xCentre = config.pinElement.position().left + (config.pinElement.outerWidth() / 2);

            return {
                top: yCentre - (config.tooltipElement.outerHeight(true) / 2),
                left: xCentre - (config.tooltipElement.outerWidth(true) / 2)
            };
        },

        checkTooltipWithinBounds: function(config, alignedPosition) {
            var parentElement = $('.hotgraphic-graphic');

            return [
                alignedPosition.left > 0,
                alignedPosition.top > 0,
                alignedPosition.left + config.tooltipElement.outerWidth() < parentElement.width(),
                alignedPosition.top + config.tooltipElement.outerHeight() < parentElement.height()
            ].every(Boolean);
        },

        setTooltipEventListener: function(config) {

            if (Adapt.device.touch && !config.tooltipConfig._alwaysShowOnTouch) return;

            var alwaysShowOnTouchDevice = Adapt.device.touch && config.tooltipConfig._alwaysShowOnTouch;
            var alwaysShowOnDesktop = !Adapt.device.touch && !config.tooltipConfig._desktopShowOnHover;

            if (alwaysShowOnTouchDevice || alwaysShowOnDesktop) {
                config.tooltipElement.css('visibility', 'visible');
                return;
            }

            config.pinElement.hover(function() {
                config.tooltipElement.css('visibility', 'visible');
            }, function() {
                config.tooltipElement.css('visibility', 'hidden');
            });
        },

        onPinClicked: function (event) {
            if(event) event.preventDefault();

            var item = this.model.getItem($(event.currentTarget).data('index'));
            item.toggleActive(true);
            item.toggleVisited(true);

            this.openPopup();
        },

        openPopup: function() {
            if (this._isPopupOpen) return;

            this._isPopupOpen = true;

            this.popupView = new HotgraphicPopupView({
                model: this.model
            });

            Adapt.trigger("notify:popup", {
                _view: this.popupView,
                _isCancellable: true,
                _showCloseButton: false,
                _closeOnBackdrop: true,
                _classes: ' hotgraphic'
            });

            this.listenToOnce(Adapt, {
                'popup:closed': this.onPopupClosed
            });
        },

        onPopupClosed: function() {
            this.model.getActiveItem().toggleActive();
            this._isPopupOpen = false;
        }

    });

    return HotGraphicView;

});
