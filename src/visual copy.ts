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
import { Primitive, select } from "d3";

interface DataPoint {
    category: Date;
    active: boolean;
    index: number;
    identity: powerbi.visuals.ISelectionId;  // each specific data point represents a specific category or measure or series or combination of those 
    // highlighted: boolean;
};

interface ViewModel {
    dataPoints: DataPoint[];
    // highlights: boolean;    
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
    private margin = { left:18, right:18, top:10, bottom:30 };
    private selected = new Array();

    constructor(options: VisualConstructorOptions) {
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

    public update(options: VisualUpdateOptions) {
        // let sample: DataPoint[] = [
        //     {
        //         category: new Date(2019, 4, 1)
        //     },
        //     {
        //         category: new Date(2019, 5, 1)
        //     },
        //     {
        //         category: new Date(2019, 6, 1)
        //     },
        //     {
        //         category: new Date(2019, 7, 1)
        //     },
        //     {
        //         category: new Date(2019, 8, 1)
        //     },
        // ];
    
        //     let viewModel: ViewModel = {
        //         dataPoints: sample
        //     };
        
        let viewModel = this.getViewModel(options);
        console.log(viewModel)
        let width: number = options.viewport.width;
        let height: number = options.viewport.height;
        this.svg
            .attr("width", width)
            .attr("height", height);

        this.svg
            .on("mousemove", mousemove)
            .on("mouseout", mouseout);

        let xScale = d3.scaleTime()
            // .domain([new Date("2017-01-01"), new Date()])
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
            .style("font-style", "italic")

        let bub = this.barGroup.append("circle")
            .attr("id", "bub")
            .attr("cx", 60)
            .attr("cy", height - this.margin.bottom)
            .attr("r", 2)
            .style("fill-opacity", 0)
            .style("stroke", "black")
            .style("stroke-width", 0)

        var maxItem = 0;
        var minItem = 0;
        var timeout = null;

        let cirs = this.barGroup
            .selectAll(".bar")
            .data(viewModel.dataPoints);

        let itemTxt = this.barGroup
            .selectAll(".itemTxt")
            .data(viewModel.dataPoints);

        var format = d3.timeFormat("%b %y");

        function mousemove() {
            bub
                .attr("cx", d3.mouse(this)[0])
                .style("stroke-width", 1);
        }

        function mouseout() {
            bub
                .attr("cx", d3.mouse(this)[0])
                .style("stroke-width", 0);
        }
 
        itemTxt.enter()
            .append("text")
            .classed("itemTxt", true)
            .attr("x", d => xScale(d.category))
            .attr("y", height - 45)
            .attr("font-size", "10px")
            .attr("text-anchor", "middle")
            .style("fill-opacity", 0)
            .attr("transform", "rotate(0)")
            .text(d => format(d.category));

        itemTxt.attr("x", d => xScale(d.category))
            .attr("y", height - 45)
            .attr("font-size", "10px")
            .attr("text-anchor", "middle")
            .style("fill-opacity", 0)
            .attr("transform", "rotate(0)")
            .text(d => format(d.category));

        cirs.enter()
            .append("circle")
            .classed("bar", true)
            .attr("cy", height - this.margin.bottom)
            .attr("cx", d => xScale(d.category))
            .attr("r", 10)
            .style("fill", "grey")
            .style("fill-opacity", 0.3)
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .on("click", (d,i,n) => {
                d.active = true;
                maxItem = d3.max(viewModel.dataPoints.filter(d => d.active == true), (d) => d.index)
                minItem = d3.min(viewModel.dataPoints.filter(d => d.active == true), (d) => d.index)
                d3.select(d3.event.currentTarget).style("fill-opacity",1);
                for (let j=0, len = n.length; j < len; j++) {
                        if (this.selected.indexOf(j)>-1){
                            console.log('cancel')
                            this.selectionManager
                            .select(viewModel.dataPoints[j].identity, true)
                        }
                        var range = j >= minItem && j <= maxItem;
                        if (range) { 
                            console.log('select',n[j].style.fillOpacity)
                        this.selectionManager
                            .select(viewModel.dataPoints[j].identity, true);
                        this.selected.push(j);
                        n[j].style.fillOpacity = "1"
                        
                        }
                        console.log('array',this.selected, 'include?', this.selected.indexOf(j))
                };
                d3.selectAll(".itemTxt")
                        .each(function(d,i,n) {
                            i == minItem || i == maxItem ?
                            d3.select(n[i]).style('fill-opacity',1):
                            d3.select(n[i]).style('fill-opacity',0)
                        }

                        )
                    
                
                // d3.selectAll(".bar")
                //     .each(function (d) {
                //        return   console.log(d3.select(this).attr("cx"),  viewModel.dataPoints[0].active )})


                // for (let i=0, len = n.length; i < len; i++) {
                //     var range = i >= minItem && i <= maxItem;
                //     range ? n[i].selectionManager
                // };
                // d3.selectAll(".bar")
                    
                    // .each(function (){
                    //     console.log(d3.select(this).attr("cx"))})

                    // .each(function (d, i) {
                    //     return function(d, i)  {
                    //     var range = d.index >= minItem && d.index <= maxItem;
                    //     console.log(d.categories);
                    //     d3.select(d3.event.currentTarget)
                    //         .style('fill', range ? 'steelblue' : 'grey')
                    //         .style('fill-opacity', range ? 1 : 0.3)

                    //     range ? d.active = true : d.active = false
                    // }});
                console.log(d.active, d.index, maxItem, minItem);
            });

        // Don't combine the attribute with the append, it would lose the ability to resize    
        cirs.attr("cy", height - this.margin.bottom)
        .attr("cx", d => xScale(d.category))
        .attr("r", 10)
        .style("fill", "grey")
        .style("fill-opacity", 0.3);
        
        
        
        
        
        
        
        // .on("click", (d) => {
        //     this.selectionManager
        //         .select(d.identity, true)
        //         .then(ids => {
        //             cirs.style("fill-opacity", d => ids.length > 0 ?  
        //              ids.indexOf(d.identity) >= 0 ? 1.0 : 0.5 
        //              : 1.0
        //             )
        //     console.log(viewModel.dataPoints.map(d=>d.identity))
        //     console.log(viewModel.dataPoints.map(d=>ids.indexOf(d.identity)))    
        //         });
        // });
        

        cirs.exit()
            .remove();


        itemTxt.exit()
            .remove();

// Create Event Handlers for mouse
function handleMouseOver(d, i) {  // Add interactivity

    // Specify where to put label of text
        d3.select(".bar-group").append("text")
        .classed("float", true)
        // .classed("t" + d.category + "-" + i, true)  // Create an id for text so we can select it later for removing on mouseout
        .attr("x", xScale(d.category))                               // I don't understand what's the difference of the two
        .attr("y", height - 45)
        .attr("font-size", "10px")
        .attr("text-anchor", "middle")
        .text(format(d.category));
    
}

function handleMouseOut(d, i) {

    // Select text by id and then remove
    d3.select(".float").remove();  // Remove text location
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
            {return console.log(true),
            viewModel;}
        
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