/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import * as models from "powerbi-models";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import IVisualhost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import * as d3 from "d3";
import IFilterColumnTarget = models.IFilterColumnTarget
import IBasicFilter = models.IBasicFilter
import BasicFilter = models.BasicFilter
import AdvancedFilter = models.AdvancedFilter

interface DataPoint {
    category: Date;
    active: boolean;
    index: number;
    identity: powerbi.visuals.ISelectionId;  // each specific data point represents a specific category or measure or series or combination of those 
};

interface ViewModel {
    dataPoints: DataPoint[];
};

import { VisualSettings } from "./settings";
export class Visual implements IVisual {
    private settings: VisualSettings;
    private host: IVisualhost;
    private svg: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private barGroup: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private movingTxt: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private xAxisGroup: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private yAxisGroup: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private selectionManager: ISelectionManager;  // allows us to tell Power Bi that the user has selected sth on this visual you may want to do sth about it
    private margin = { left:35, right:35, top:30, bottom:30 };
    private selected = new Array();
    private lastSelectedId: number;
    private counter: number;
    private isDblClkActive: boolean = false;
    private viewModel: ViewModel

    constructor(options: VisualConstructorOptions) {
        console.log(options)
        this.host = options.host;
        this.svg = d3.select(options.element)
            .append("svg")
            .classed("my-little-bar-chart", true);
        this.barGroup = this.svg.append("g")
            .classed("bar-group", true);

        this.xAxisGroup = this.svg.append("g")
            .classed("x-axis", true)

        this.yAxisGroup = this.svg.append("g")
            .classed("y-axis", true)

        this.selectionManager = this.host.createSelectionManager();
        
    }

    /**
     * update
     */
    public update(options: VisualUpdateOptions) {
        this.settings = VisualSettings.parse<VisualSettings>(options.dataViews[0])
        if (this.settings.dataPoint.layout == "0") { 
            this.xAxisGroup.style("opacity", 1)
            this.yAxisGroup.style("opacity", 0)
            this.horizontalLayout(options) 

        } else {
            this.xAxisGroup.style("opacity", 0)
            this.yAxisGroup.style("opacity", 1)
            this.verticalLayout(options)
        }
    }
    
    public horizontalLayout(options: VisualUpdateOptions) {
        
        let viewModel:ViewModel
        if (!this.isDblClkActive) {this.viewModel= this.getViewModel(options)};
        viewModel = this.viewModel
        this.counter = d3.max(viewModel.dataPoints, (d,i) => i) + 1
        let width: number = options.viewport.width;
        let height: number = options.viewport.height;
        this.svg
            .attr("width", width)
            .attr("height", height);

        this.settings = VisualSettings.parse<VisualSettings>(options.dataViews[0])

        let xScale = d3.scaleTime()
            .domain([d3.min(viewModel.dataPoints, d => d.category)
                , d3.max(viewModel.dataPoints, d => d.category)])
            .nice()
            .range([this.margin.left, width - this.margin.right]); 
         
        let xAxisCall = d3.axisBottom(xScale)
            .scale(xScale)
            .ticks(4)
            .tickSizeOuter(1)
            .tickPadding(10)
            .tickFormat(d3.timeFormat("%b %y"))
        
        let aXisHeight = height - this.margin.bottom
        this.xAxisGroup
            .attr("transform", "translate(0, " + aXisHeight + ")")
            .call(xAxisCall)

        d3.selectAll(".tick text")
            .style("fill", "grey")
            // .style("font-style", "italic")
            .style("fill-opacity", 0.7)
            .attr("transform", "translate(0, 0) rotate(0)")

        let rectWidth: number = (width - this.margin.left - this.margin.right)/this.counter
        let maxItem = 0;
        let minItem = 0;
        let StartDate: Date;
        let EndDate: Date;
        let category = options.dataViews[0].categorical.categories[0];
        let target: IFilterColumnTarget = {
            table: category.source.queryName.substr(0, category.source.queryName.indexOf('.')),
            column: category.source.displayName
        };
        
        if(options.jsonFilters[0]){
            StartDate = options.jsonFilters[0].conditions[0].value as Date;
            EndDate = options.jsonFilters[0].conditions[1].value as Date;
        }
        
        let bars = this.barGroup
            .selectAll(".bar")
            .data(viewModel.dataPoints);

        let itemTxt = this.barGroup
            .selectAll(".itemTxt")
            .data(viewModel.dataPoints);

        let floatTxt = this.barGroup
            .selectAll(".float")
            .data(viewModel.dataPoints);

        var format = d3.timeFormat(this.settings.dataPoint.dateFormat);

        itemTxt.enter()
            .append("text")
            .classed("itemTxt", true)
            .attr("x", d => xScale(d.category))
            .attr("y", height - 45)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .attr("text-anchor", "middle")
            .style("fill-opacity",  d => new Date(d.category).getTime() == new Date(StartDate).getTime() || new Date(d.category).getTime() == new Date(EndDate).getTime()  ? 1 : 0)
            .text(d => format(d.category));

        floatTxt.enter()
            .append("text")
            .classed("float", true)
            .attr("x", d => xScale(d.category))
            .attr("y", height - 45)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .attr("text-anchor", "middle")
            .style("fill-opacity", 0)
            .text(d => format(d.category));
        
        bars.enter()
            .append("rect")
            .classed("bar", true)
            .attr("y", height - this.margin.bottom - 10)
            .attr("x", d => xScale(d.category) - rectWidth/2)
            .attr("height", 20)
            .attr("width", rectWidth)
            .style("fill",  d => d.category >= new Date(StartDate) && d.category <= new Date(EndDate) ? this.settings.dataPoint.fill : "grey")
            .style("fill-opacity",  d => d.category >= new Date(StartDate) && d.category <= new Date(EndDate) ? 1 : 0.3)
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .on("dblclick", handleDblClick.bind(this))
            .on("click", handleClick.bind(this));

        // Don't combine the attribute with the append, it would lose the ability to resize    
        itemTxt.attr("x", d => xScale(d.category))
            .attr("y", height - 45)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .text(d => format(d.category));

        bars.attr("y", height - this.margin.bottom - 10)
            .attr("x", d => xScale(d.category) - rectWidth/2)
            .attr("width", rectWidth)
            .attr("height", 20)
            .style("fill",  d => d.category >= new Date(StartDate) && d.category <= new Date(EndDate) ? this.settings.dataPoint.fill : "grey")
            

        floatTxt.attr("x", d => xScale(d.category))
            .attr("y", height - 45)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .text(d => format(d.category));

        bars.exit()
            .remove();


        itemTxt.exit()
            .remove();

       

        // Create Event Handlers for mouse
        function handleMouseOver(d, i) {  
            let chosen = i
            d3.selectAll(".float")
                .each(function(d,i,n) {
                    d3.select(n[i]).style("fill-opacity", i == chosen ? 1 : 0)
                })
        }

        function handleMouseOut(d, i) {

            // Select text by id and then remove
            d3.selectAll(".float").style("fill-opacity", 0);  // Remove text location
        }


        function handleDblClick(d, i) {
        
            this.isDblClkActive = true;
            d3.selectAll(".bar")
                .style("fill", "grey")
                .style("fill-opacity", 0.3)
        
            d3.selectAll(".itemTxt")
                .style("fill-opacity", 0)
            viewModel.dataPoints.forEach(d => d.active=false);      
            let filter: AdvancedFilter    
            
            if (this.lastSelectedId != i) {
                d.active = true;
                d3.select(d3.event.currentTarget)
                    .style("fill", this.settings.dataPoint.fill)
                    .style("fill-opacity", 1)

                maxItem = d.index
                minItem = d.index

                d3.selectAll(".itemTxt")
                    .each(function (d, i, n) {
                        var chosen = d.index == minItem || d.index == maxItem;
                        d3.select(n[i])
                            .style('fill-opacity', chosen ? 1 : 0);
                    }.bind(this))
                
                this.lastSelectedId = i;

                StartDate = d.category;
                EndDate = d.category;    
                filter = new AdvancedFilter(
                    target, 
                    "And", 
                    {
                        operator: "GreaterThanOrEqual",
                        value: StartDate,
                    },
                    {
                        operator: "LessThanOrEqual",
                        value: EndDate,
                    });
                this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
            } else {
                this.lastSelectedId = "";
                filter = new AdvancedFilter(target, "And",null);
                this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.remove);
            }
            
        };

        function handleClick(d,i,n) {

            this.isDblClkActive = true;
            d.active = true;
            maxItem = d3.max(viewModel.dataPoints.filter(d => d.active == true), (d) => d.index)
            minItem = d3.min(viewModel.dataPoints.filter(d => d.active == true), (d) => d.index)
            EndDate = d3.max(viewModel.dataPoints.filter(d => d.active == true), (d) => d.category)
            StartDate = d3.min(viewModel.dataPoints.filter(d => d.active == true), (d) => d.category)
            d3.select(d3.event.currentTarget).style("fill-opacity", 1);
            d3.selectAll(".bar")
                .each(function (d, i, n) {
                    var range = d.index >= minItem && d.index <= maxItem;
                    d3.select(n[i])
                        .style('fill', range ? this.settings.dataPoint.fill : 'grey')
                        .style('fill-opacity', range ? 1 : 0.3)

                    range ? d.active = true : d.active = false
                }.bind(this))

            d3.selectAll(".itemTxt")
                .each(function (d, i, n) {
                    i == minItem || i == maxItem ?
                        d3.select(n[i]).style('fill-opacity', 1) :
                        d3.select(n[i]).style('fill-opacity', 0)
                })   
            let filter: AdvancedFilter    
            filter = new AdvancedFilter(
                target, 
                "And", 
                {
                    operator: "GreaterThanOrEqual",
                    value: StartDate,
                },
                {
                    operator: "LessThanOrEqual",
                    value: EndDate,
                });
            this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
            this.viewModel = viewModel;
        }
    }

    public verticalLayout(options: VisualUpdateOptions) {
        
        let viewModel:ViewModel
        if (!this.isDblClkActive) {this.viewModel= this.getViewModel(options)};
        viewModel = this.viewModel
        this.counter = d3.max(viewModel.dataPoints, (d,i) => i) + 1
        let width: number = options.viewport.width;
        let height: number = options.viewport.height;
        this.svg
            .attr("width", width)
            .attr("height", height);
        let maxItem = 0;
        let minItem = 0;
        let StartDate: Date;
        let EndDate: Date;

        let rectHeight: number = (height - this.margin.top - this.margin.bottom) / this.counter
    
        let category = options.dataViews[0].categorical.categories[0];
        let target: IFilterColumnTarget = {
            table: category.source.queryName.substr(0, category.source.queryName.indexOf('.')),
            column: category.source.displayName
        };

        if (options.jsonFilters[0]) {
            StartDate = options.jsonFilters[0].conditions[0].value as Date;
            EndDate = options.jsonFilters[0].conditions[1].value as Date;
        }

        this.settings = VisualSettings.parse<VisualSettings>(options.dataViews[0])

        let xScale = d3.scaleTime()
            .domain([d3.min(viewModel.dataPoints, d => d.category)
                , d3.max(viewModel.dataPoints, d => d.category)])
            .nice()
            .range([this.margin.top, height - this.margin.bottom]);

        let yAxisCall = d3.axisLeft(xScale)
            .scale(xScale)
            .ticks(4)
            .tickSizeOuter(1)
            .tickPadding(10)
            .tickFormat(d3.timeFormat("%b %y"))

        let aXisHeight = height - this.margin.bottom
        this.yAxisGroup
            .attr("transform", "translate(30, 0)")
            .call(yAxisCall)

        d3.selectAll(".tick text")
            .style("fill", "grey")
            // .style("font-style", "italic")
            .style("fill-opacity", 0.7)
            .attr("transform", "translate(-20, 30) rotate(90)")


        let bars = this.barGroup
            .selectAll(".bar")
            .data(viewModel.dataPoints);

        let itemTxt = this.barGroup
            .selectAll(".itemTxt")
            .data(viewModel.dataPoints);

        let floatTxt = this.barGroup
            .selectAll(".float")
            .data(viewModel.dataPoints);

        var format = d3.timeFormat(this.settings.dataPoint.dateFormat);


        itemTxt.enter()
            .append("text")
            .classed("itemTxt", true)
            .attr("y", d => xScale(d.category))
            .attr("x", 65 + this.settings.dataPoint.fontSize * 2 - 24)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .attr("text-anchor", "middle")
            .style("fill-opacity", d => new Date(d.category).getTime() == new Date(StartDate).getTime() || new Date(d.category).getTime() == new Date(EndDate).getTime() ? 1 : 0)
            .attr("transform", "rotate(0)")
            .text(d => format(d.category));

        floatTxt.enter()
            .append("text")
            .classed("float", true)
            .attr("y", d => xScale(d.category))
            .attr("x", 65 + this.settings.dataPoint.fontSize * 2 - 24)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .attr("text-anchor", "middle")
            .style("fill-opacity", 0)
            .attr("transform", "rotate(0)")
            .text(d => format(d.category));

        bars.enter()
            .append("rect")
            .classed("bar", true)
            .attr("x", 20)
            .attr("y", d => xScale(d.category) - rectHeight / 2)
            .attr("width", 20)
            .attr("height", rectHeight)
            .style("fill", d => d.category >= new Date(StartDate) && d.category <= new Date(EndDate) ? this.settings.dataPoint.fill : "grey")
            .style("fill-opacity", d => d.category >= new Date(StartDate) && d.category <= new Date(EndDate) ? 1 : 0.3)
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .on("dblclick", handleDblClick.bind(this))
            .on("click", handleClick.bind(this));

        // Don't combine the attribute with the append, it would lose the ability to resize    
        itemTxt.attr("y", d => xScale(d.category))
            .attr("x", 65 + this.settings.dataPoint.fontSize * 2 - 24)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .text(d => format(d.category));

        bars.attr("x", 20)
            .attr("y", d => xScale(d.category) - rectHeight / 2)
            .attr("height", rectHeight)
            .attr("width", 20)
            .style("fill", d => d.category >= new Date(StartDate) && d.category <= new Date(EndDate) ? this.settings.dataPoint.fill : "grey")


        floatTxt.attr("y", d => xScale(d.category))
            .attr("x", 65 + this.settings.dataPoint.fontSize * 2 - 24)
            .attr("font-size", this.settings.dataPoint.fontSize)
            .text(d => format(d.category));

        bars.exit()
            .remove();


        itemTxt.exit()
            .remove();

        

        // Create Event Handlers for mouse
        function handleMouseOver(d, i) {  
            let chosen = i
            d3.selectAll(".float")
                .each(function(d,i,n) {
                    d3.select(n[i]).style("fill-opacity", i == chosen ? 1 : 0)
                })
        }

        function handleMouseOut(d, i) {

            // Select text by id and then remove
            d3.selectAll(".float").style("fill-opacity", 0);  // Remove text location
        }


        function handleDblClick(d, i) {
        
            this.isDblClkActive = true;
            d3.selectAll(".bar")
                .style("fill", "grey")
                .style("fill-opacity", 0.3)
        
            d3.selectAll(".itemTxt")
                .style("fill-opacity", 0)
            viewModel.dataPoints.forEach(d => d.active=false);      
            let filter: AdvancedFilter    
            
            if (this.lastSelectedId != i) {
                d.active = true;
                d3.select(d3.event.currentTarget)
                    .style("fill", this.settings.dataPoint.fill)
                    .style("fill-opacity", 1)

                maxItem = d.index
                minItem = d.index

                d3.selectAll(".itemTxt")
                    .each(function (d, i, n) {
                        var chosen = d.index == minItem || d.index == maxItem;
                        d3.select(n[i])
                            .style('fill-opacity', chosen ? 1 : 0);
                    }.bind(this))
                
                this.lastSelectedId = i;

                StartDate = d.category;
                EndDate = d.category;    
                filter = new AdvancedFilter(
                    target, 
                    "And", 
                    {
                        operator: "GreaterThanOrEqual",
                        value: StartDate,
                    },
                    {
                        operator: "LessThanOrEqual",
                        value: EndDate,
                    });
                this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
            } else {
                this.lastSelectedId = "";
                filter = new AdvancedFilter(target, "And",null);
                this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.remove);
            }
            
        };

        function handleClick(d,i,n) {

            this.isDblClkActive = true;
            d.active = true;
            maxItem = d3.max(viewModel.dataPoints.filter(d => d.active == true), (d) => d.index)
            minItem = d3.min(viewModel.dataPoints.filter(d => d.active == true), (d) => d.index)
            EndDate = d3.max(viewModel.dataPoints.filter(d => d.active == true), (d) => d.category)
            StartDate = d3.min(viewModel.dataPoints.filter(d => d.active == true), (d) => d.category)
            d3.select(d3.event.currentTarget).style("fill-opacity", 1);
            d3.selectAll(".bar")
                .each(function (d, i, n) {
                    var range = d.index >= minItem && d.index <= maxItem;
                    d3.select(n[i])
                        .style('fill', range ? this.settings.dataPoint.fill : 'grey')
                        .style('fill-opacity', range ? 1 : 0.3)

                    range ? d.active = true : d.active = false
                }.bind(this))

            d3.selectAll(".itemTxt")
                .each(function (d, i, n) {
                    i == minItem || i == maxItem ?
                        d3.select(n[i]).style('fill-opacity', 1) :
                        d3.select(n[i]).style('fill-opacity', 0)
                })   
            let filter: AdvancedFilter    
            filter = new AdvancedFilter(
                target, 
                "And", 
                {
                    operator: "GreaterThanOrEqual",
                    value: StartDate,
                },
                {
                    operator: "LessThanOrEqual",
                    value: EndDate,
                });
            this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
            this.viewModel = viewModel;
        }
    }

    private getViewModel(options: VisualUpdateOptions): ViewModel {
        let dv = options.dataViews;
        let viewModel: ViewModel = {
            dataPoints: []
            // highlights: false
        };

        if (!dv
            || !dv[0].categorical
            || !dv[0].categorical.categories
            || !dv[0].categorical.categories[0].source)
            return viewModel;
        
        let view = dv[0].categorical;
        let categories = view.categories[0];
        // let values = view.values[0];
        // let highlights = values.highlights;
        for (let i=0, len = categories.values.length; i < len; i++) {
            viewModel.dataPoints.push({
                category: <Date>categories.values[i],
                active: false,
                index: i,
                identity: this.host.createSelectionIdBuilder()
                    .withCategory(categories, i)
                    .createSelectionId(),
                // highlighted: highlights ? highlights[i] ? true : false : false
            })
        }

        // viewModel.highlights = viewModel.dataPoints.filter(d => d.highlighted).length > 0;

        return viewModel
        
    }


    private static parseSettings(dataView: DataView): VisualSettings {
        return VisualSettings.parse(dataView) as VisualSettings;
    }



    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    }
}