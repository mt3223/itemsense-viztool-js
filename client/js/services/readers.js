/**
 * Created by ralemy on 11/21/15.
 * controls the display of readers
 */

"use strict";

module.exports = (function (app) {
    app.factory("StageMetrics", [function () {
            return function (ref, stage, xKey, yKey) {
                xKey = xKey || "x";
                yKey = yKey || "y";
                if (ref.x === undefined)
                    Object.defineProperties(ref, {
                        x: {
                            configurable: true,
                            get: function () {
                                return ref[xKey];
                            },
                            set: function (v) {
                                ref[xKey] = v;
                            }
                        },
                        y: {
                            configurable: true,
                            get: function () {
                                return ref[yKey];
                            },
                            set: function (v) {
                                ref[yKey] = v;
                            }
                        }
                    });
                //Expects ref to have x and y, in meters from origin. (what is supplied by item sense)
                Object.defineProperties(ref, {
                    _x: { //x for the shape
                        configurable: true,
                        get: function () {
                            return stage.metersToStage(ref.x, "x");
                        },
                        set: function (v) {
                            ref.x = stage.stageToMeters(v, "x");
                        }
                    },
                    _y: { //y for the shape
                        configurable: true,
                        get: function () {
                            return stage.metersToStage(ref.y, "y");
                        },
                        set: function (v) {
                            ref.y = stage.stageToMeters(v, "y");
                        }
                    },
                    X: { // X in meters, to display on UI
                        configurable: true,
                        get: function () {
                            return Math.round10(ref.x, -3);
                        },
                        set: function (v) {
                            ref.x = v;
                        }
                    },
                    Y: { // Y in meters to display on UI
                        configurable: true,
                        get: function () {
                            return Math.round10(ref.y, -3);
                        },
                        set: function (v) {
                            ref.y = v;
                        }
                    }
                });
                return ref;
            };
        }])
        .factory("ReaderModel", ["StageMetrics", function (StageMetrics) {
            //ToDo: extend to have properties that readers need to be shown on stage.
            return function (ref, stage) {
                return StageMetrics(ref, stage);
            };
        }])
        .factory("Reader", ["CreateJS", "ReaderModel", function (createjs, ReaderModel) {
            const colors = {engage: "green", disengage: "gray", active: "red", occupied: "yellow", inactive:"blue"};
            return {
                create: function (reader, stage, engaged) {
                    engaged = engaged || "inactive";
                    var field = new createjs.Shape(),
                        device = new createjs.Shape(),
                        ref = reader ? reader.placement : {},
                        model = ReaderModel(ref, stage),
                        zoomHandler = null, moved = false,
                        prevColor = engaged ? colors[engaged] : colors.disengage,
                        color = prevColor,
                        lastX, lastY,
                        wrapper = Object.create({
                            destroy: function (update) {
                                stage.removeChild(device);
                                stage.removeChild(field);
                                if (zoomHandler)
                                    stage.off("Zoom", zoomHandler);
                                if (update)
                                    stage.update();
                            },
                            hasStatus: status => color === colors[status] || (color === colors.active && prevColor === colors[status]),
                            shouldDrawFields: function () {
                                if (reader.type !== "XARRAY") return false;
                                if (this.hasStatus("engage")) return true;
                                return this.hasStatus("inactive");
                            },
                            drawFields: function () {
                                var g = field.graphics.clear().s("brown").ss(1);
                                if (!this.shouldDrawFields())
                                    return;
                                if (stage.showReaderFields > 2)
                                    g = g.f("rgba(200,0,0,0.2)").dc(0, 0, stage.metersToCanvas(5));
                                if (stage.showReaderFields > 1)
                                    g = g.f("rgba(200,200,0,0.2)").dc(0, 0, stage.metersToCanvas(4));
                                if (stage.showReaderFields)
                                    g.f("rgba(0,200,0,0.2)").dc(0, 0, stage.metersToCanvas(3));
                            },
                            drawDevice: function () {
                                var l = stage.screenToCanvas(10),
                                    r = stage.screenToCanvas(3);
                                if (reader.type === "XARRAY")
                                    device.graphics.clear().s("brown").ss(1).f(color).r(-l, -l, l * 2, l * 2).dc(0, -l, r);
                                else
                                    device.graphics.clear().s("brown").ss(1).f(color).dc(0, 0, l);
                            },
                            draw: function (update) {
                                this.drawFields();
                                this.drawDevice();
                                field.x = device.x = model._x;
                                field.y = device.y = model._y;
                                device.rotation = model.yaw;
                                if (update)
                                    stage.update();
                            },
                            setStatus(key,update){
                                if (color === colors.active)
                                    prevColor = colors[key];
                                else {
                                    color = colors[key];
                                    this.draw(update);
                                }
                            },
                            activate: function (noForce) {
                                prevColor = color;
                                color = colors.active;
                                this.draw(true);
                                stage.dispatchEvent(new createjs.Event("newReader").set({
                                    reader: wrapper,
                                    force: !noForce
                                }));
                            },
                            deactivate: function () {
                                color = prevColor;
                                this.draw(true);
                            }
                        }, {
                            shape: {
                                get: function () {
                                    return device;
                                },
                                set: function (v) {
                                    device = v;
                                }
                            },
                            ref: {
                                get: function () {
                                    return ref;
                                }
                            },
                            model: {
                                get: function () {
                                    return reader;
                                }
                            }
                        });
                    device.name = "Reader";
                    field.name = "Field";
                    device.on("mousedown", function (ev) {
                        wrapper.activate();
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        moved = false;
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    device.on("pressmove", function (ev) {
                        var zoom = stage.zoom;
                        model._x += (ev.stageX - lastX) / zoom;
                        model._y += (ev.stageY - lastY) / zoom;
                        wrapper.draw(true);
                        lastX = ev.stageX;
                        lastY = ev.stageY;
                        moved = true;
                        if (stage.scope)
                            stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    device.on("pressup",function(ev){
                        if(!moved) return;
                        stage.dispatchEvent(new createjs.Event("shouldSave").set({subject:"readers"}));
                        stage.scope.$apply();
                        ev.preventDefault();
                        ev.stopPropagation();
                    });
                    stage.addChild(field);
                    stage.addChild(device);
                    zoomHandler = stage.on("Zoom", function () {
                        wrapper.draw();
                    });
                    wrapper.draw();
                    return wrapper;
                }
            };
        }]);
})(angular.module(window.mainApp));