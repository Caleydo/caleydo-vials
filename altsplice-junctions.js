/**
 * Created by Bilal Alsallakh 02/01/14
 * Based on work by Joseph Botros
 */

/**
 * Isoform + Frequency Visualization
 */

define(['exports', 'd3', 'altsplice-gui', '../caleydo/event'], function (exports, d3, gui, event) {
  /**
   * a simple template class of a visualization. Up to now there is no additional logic required.
   * @param data
   * @param parent
   * @constructor
   */
  function GenomeVis(data, parent) {
    this.data = data;
    this.parent = parent;
    this.node = this.build(d3.select(parent));
    //gui.allVisUpdates.push(function(){
    //  console.log("argh", this);
    //})
  }

  /**
   * factory method of this module
   * @param data the data to show
   * @param parent the parent dom element to append
   * @returns {GenomeVis} the visualization
   */
  function create(data, parent) {
    return new GenomeVis(data, parent);
  }

  var margin = {top: 40, right: 10, bottom: 20, left: 10};
  var width; // = 1050 - margin.left - margin.right,
  var groupWidth;
  var expandedWidth;
  var height = 450 - margin.top - margin.bottom;
  var dotRadius = 4;
  var triangleLength = 8;
  var defaultDotColor = "rgba(0,0,0,0.6)";
  var dehighlightedDotColor = "rgba(0,0,0,0.2)";
  var highlightedDotColor = "red";
  var weightAxisCaptionWidth = 25;
  var exonWeightsAreaHeight;
  var jxnWrapperPadding = 6;
  var sitePadding = 2;
  var jxnWrapperHeight = 250;
  var miniExonHeight = 8;
  var jxnCircleRadius = 3;
  var hoveredEdgeColor = "orange";
  var jxnBBoxWidth = jxnCircleRadius * 4;

  var RNAHeight = 80;
  var RNAMargin = 50;
  var isoformEdgePadding = 9;

  var curGene;
  var curExons;
  var expandedIsoform = null;
  var selectedIsoform = null;


  var jxnsData;
  var allSamples;
  var sampleLength;

  var allIsoforms;
  var allExons;
  var jxnGroups = [];
  var edgeCount;
  var axis;
  var startCoord;
  var endCoord;
  var buckets;


  var jxnArea;
  var yScaleContJxn;
  var xJxnBoxScale = d3.scale.linear();
  var showAllDots = false;
  var showDotGroups = false;
  var jitterDots = false;
/*  var groups = [{"samples": ["heartWT1", "heartWT2"], "color": "#a6cee3"},
    {"samples": ["heartKOa", "heartKOb"], "color": "#b2df8a"}]; */
  var groups = [];

  var groupColors = [
    "#a6cee3",
    "#1f78b4",
    "#b2df8a",
    "#33a02c",
    "#fb9a99",
    "#e31a1cv",
    "#fdbf6f",
    "#ff7f00",
    "#cab2d6",
    "#6a3d9a",

  ];

    GenomeVis.prototype.build = function ($parent) {

    var that = this;
    axis = that.data.genomeAxis;

    width = axis.getWidth();

    var viewOptionsDiv = $parent.append("div").style({
      "left": "20px"
    });

      $('<input />', { type: 'checkbox', id: 'cbshowGroups', value: "showGroups" }).appendTo(viewOptionsDiv);
      $('<label />', { 'for': 'cb', text: "Show groups" }).appendTo(viewOptionsDiv);
      $('#cbshowGroups').change(function() {
        showDotGroups = $(this).is(":checked")
        if (expandedIsoform != null) {
          expandIsoform(expandedIsoform);
        }
      });

      $('<input />', { type: 'checkbox', id: 'cbDotVisibility', value: "DotVisibility" }).appendTo(viewOptionsDiv);
      $('<label />', { 'for': 'cb', text: "Show all dots" }).appendTo(viewOptionsDiv);
      $('#cbDotVisibility').change(function() {
        showAllDots = $(this).is(":checked")
        updateDotVisibility();
      });

      $('<input />', { type: 'checkbox', id: 'cbJitterDots', value: "jitterDots" }).appendTo(viewOptionsDiv);
      $('<label />', { 'for': 'cb', text: "Jitter dots" }).appendTo(viewOptionsDiv);
      $('#cbJitterDots').change(function() {
        jitterDots = $(this).is(":checked")
        updateDotJitter();
      });

      event.on("isoFormSelect", function(ev,data){
      var index  = data.index;

      if (expandedIsoform != null && expandedIsoform != data) {
        collapseIsoform(expandedIsoform, function() {
          selectIsoform(data);
        })
      }
      else
        selectIsoform(data)

    });

      event.on("GroupingChanged", function(ev,data){
      groups = []
      var otherSamples = []
        for (var i = 0; i < data.collections.length; i++) {
          var col = data.collections[i]
          if (col.samples.length > 1) {
            groups.push({"samples": col.samples, "color": groupColors[i]})
          }
          else {
            otherSamples.push(col.samples[0])
          }
        }
      if (groups.length > 0) {
        if (otherSamples.length > 0)
          groups.push({"samples": otherSamples, "color": "gray"})
      }
      if ((expandedIsoform != null) && showDotGroups) {
        createGroups(expandedIsoform);
      }
    });

      event.on("axisChange", function(ev,data){

        computeFlagPositions()

        d3.selectAll(".RNASites").transition()
          .duration(300).attr({
            "transform": function(d, i) {return "translate(" + d.xStart + ",0)"}
          })

        d3.selectAll(".RNASiteConnector").transition()
          .duration(300).attr({
            "points": function (d, i) {
              var x1 =  d.type == "donor" ? d.xEnd : d.xStart;
              return [
                x1, (RNAHeight + triangleLength)/2,
                x1, RNAHeight/2 + triangleLength,
                axis.genePosToScreenPos(d.loc), RNAHeight,
              ]
            }
          })


        d3.selectAll(".edgeConnector").transition()
          .duration(300).attr({
            "x2": function() {
              var type = this.getAttribute("type");
              var loc = type == "donor" ?
                this.getAttribute("startLoc") :  this.getAttribute("endLoc");
              return type ==  "donor" ? getBucketAt(loc).xEnd : getBucketAt(loc).xStart;
            }
          })

        var connectors = d3.selectAll(".JXNAreaConnector");
        connectors.attr({
          "x3": function() {
            var loc = this.getAttribute("loc");
            return getBucketAt(loc).xEnd
          }
        })
        connectors.transition()
          .duration(300).attr({
            "points": function() {
              return getPoints(this)
            }
          })


      })


      var head = $parent.append("div").attr({
      "class":"gv"
    })

    // SETUP THE GUI Controls
    // createGenDefControls(head);

    // SETUP THE VIS



    var svg = head.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style({
        //"top":"10px",
        "left":"20px",
        "position":"relative"

      })

    var exploreArea = svg.append("g").attr("transform", "translate(20, 20)").attr("id","exploreArea");
    jxnArea = exploreArea.append("g").attr("id", "jxnArea");

    function updateVisualization() {

      width = axis.getWidth();

      svg.attr("width", width + margin.left + margin.right)

      curGene = gui.current.getSelectedGene();
      var curProject = gui.current.getSelectedProject();

      //console.log("ppp", curProject, curGene );
      that.data.getGeneData(curProject, curGene).then(function(sampleData) {

        jxnsData = sampleData.measures.jxns;
        allSamples = sampleData.samples;
        sampleLength = Object.keys(allSamples).length;
        allIsoforms = sampleData.gene.isoforms;
        allExons = sampleData.gene.exons;
        // TODO: Hen: workaround for missing update cycle
        jxnArea.remove();
        jxnArea = d3.select("#exploreArea").append("g").attr("id", "jxnArea");

        computeJxnGroups();
        drawJxnAxis();

        var RNAArea = exploreArea.append("g").attr({
          "id": "RNAArea",
          "transform": "translate(0," + (jxnWrapperHeight+RNAMargin) + ")"
        });
        startCoord = d3.min(jxnsData.all_starts);
        endCoord = d3.max(jxnsData.all_ends);
        // RNAScale = d3.scale.linear().domain([startCoord, endCoord]).range([triangleLength, width - triangleLength]);

        drawRNA(RNAArea);

        drawJxns();

      })
      //// should trigger a cache hit
      //that.data.getSamples(chromID,startPos,baseWidth);
    }

    function drawJxnAxis() {

      var maxJxnReads = 0;
      for (var i = 0; i < jxnsData.weights.length; i++) {
        maxJxnReads = Math.max(jxnsData.weights[i].weight, maxJxnReads);
      }
      exonWeightsAreaHeight = jxnWrapperHeight - miniExonHeight; // the lower part is the mini exon legend
      yScaleContJxn = d3.scale.linear()
        .domain([0, maxJxnReads])
        .range([exonWeightsAreaHeight- jxnCircleRadius, 2 * jxnCircleRadius]);
      var yAxisJxn = d3.svg.axis()
        .orient("left")
        .scale(yScaleContJxn);
      var edgeAxisGroup = jxnArea.append("g")
        .attr("class", "axis")
        .call(yAxisJxn)
        .attr("transform", "translate(" + weightAxisCaptionWidth + " 0)");
      edgeAxisGroup.append("text")      // text label for the x axis
        .attr("x", -20)
        .attr("y", exonWeightsAreaHeight / 2)
        .attr("font-size", 12)
        .style("text-anchor", "middle")
        .text("Junction Reads")
        .attr("transform", "rotate(-90, " + (-weightAxisCaptionWidth - 10) + " " + exonWeightsAreaHeight / 2 + ")");
    }

    function computeJxnGroups() {
      jxnsData.weights.sort(function (a, b) { return a.start < b.start ? -1 :
        a.start > b.start ? 1 :
        a.end < b.end ? - 1 :
        a.end < b.end ? 1 :
        a.weight < b.weight ? -1 : 1;
      });

      var ind = 0;
      edgeCount = 0;
      var prevStart = ind;
      var prevEnd = ind;
      var startLoc = jxnsData.weights[ind].start;
      var endLoc = jxnsData.weights[ind].end;
      var subGroups = [];
      for (ind = 1; ind < jxnsData.weights.length; ind++) {

        var startLoc2 = jxnsData.weights[ind].start;
        var endLoc2 = jxnsData.weights[ind].end;

        if (startLoc2 > startLoc || endLoc2 > endLoc) {
          subGroups.push({"start":prevEnd, "end":ind - 1, "startLoc" : startLoc, "endLoc": endLoc})
          edgeCount++;
          endLoc = endLoc2;
          prevEnd = ind;
        }
        if (startLoc2 > startLoc) {
          jxnGroups.push({"start":prevStart, "end":ind - 1, "groups": subGroups});
          subGroups = [];
          startLoc = startLoc2;
          prevStart = ind;
        }
//        console.log("Whole Gruoup: (" + startLoc + " " + startInd + " - " + ind)
      }
      subGroups.push({"start":prevEnd, "end":ind - 1, "startLoc" : startLoc, "endLoc": endLoc})
      edgeCount++
      jxnGroups.push({"start":prevStart, "end":ind - 1, "groups": subGroups});

    }

      function getBucketAt(loc) {
        for (var i = 0; i < buckets.length; i++) {
          if (buckets[i].loc == loc)
            return buckets[i];
        }
      }


      function getPoints(connector) {
        return  [
          connector.getAttribute("x1"), jxnWrapperHeight,
          connector.getAttribute("x2"), jxnWrapperHeight,
          connector.getAttribute("x3"), getDonorY(),
        ]
      }

      function getDonorY() {
        return jxnWrapperHeight + RNAMargin + RNAHeight/2 - 5
      }

      function drawJxns() {

      groupWidth =  (width - weightAxisCaptionWidth - jxnWrapperPadding * jxnGroups.length) / edgeCount;

        var grayStripesGroup = jxnArea.append("g");
        var linesGroup = jxnArea.append("g");


        var startX = weightAxisCaptionWidth + jxnWrapperPadding;
        for (var jxnGpInd = 0; jxnGpInd < jxnGroups.length; jxnGpInd++) {

          var jxnGroup = jxnGroups[jxnGpInd];
          var wrapperWidth = groupWidth * jxnGroup.groups.length;
          grayStripesGroup.append("rect").attr({
            "class": "jxnWrapperBox",
            "fill": "#ccc",
            "height": jxnWrapperHeight,
            "width": function (d, i) {
              return wrapperWidth
            },
            "transform": "translate(" + startX + ", 0)"
          })

          var donorLoc = jxnsData.weights[jxnGroup.start].start;
          jxnArea.append("polygon").attr({
            x1: startX +1,
            x2: startX + wrapperWidth -1,
            x3: getBucketAt(donorLoc).xEnd,
            "points": function() {return getPoints(this)},
            "loc": donorLoc,
            "class": "JXNAreaConnector",
            "stroke": "#ccc",
            "fill":"#ccc"
          })
          startX += groupWidth * jxnGroups[jxnGpInd].groups.length + jxnWrapperPadding;
        }

        var startX = weightAxisCaptionWidth + jxnWrapperPadding;
        for (var jxnGpInd = 0; jxnGpInd < jxnGroups.length; jxnGpInd++) {

        var jxnGroup = jxnGroups[jxnGpInd];
        var wrapperWidth = groupWidth * jxnGroup.groups.length;


        var jxnGroupWrapper = jxnArea.append("g").attr({
          "class": "jxnWrapper",
        });

        var edgeGroups = jxnGroupWrapper.selectAll(".edgeGroup").data(jxnGroup.groups).enter().append("g").attr({
          "class": "edgeGroup",
          "ActiveIsoform": -1,
          "startLoc": function(g) {return g.startLoc},
          "endLoc": function(g) {return g.endLoc},
          "transform": function(d, i) {
            return "translate(" + (startX + groupWidth * i) + ", 0)"
          },
          "startX": function(d, i) {return startX + groupWidth * i},
        });


        edgeGroups.each(function(group, groupInd) {
          var groupNode = d3.select(this);

          var y1 = jxnWrapperHeight + RNAMargin + RNAHeight/2;
          var y2 = y1 + 2 * RNAMargin;

          groupNode.append("rect").attr({
            "class": "jxnContainer",
            "startLoc": group.startLoc,
            "endLoc": group.endLoc,
            "fill": "white",
            "stroke": "black",
            "height": jxnWrapperHeight,
            "transform": " translate(" + groupWidth / 2 + ", 0)",
            "width": 0
          }).style({
            "opacity": 0,
            "visibility": "hidden"
          }).on("dblclick", function() {
            sortDots(this.parentNode);
          })


          groupNode.append("rect").attr({
            "class": "edgeAnchor",
            "startLoc": group.startLoc,
            "endLoc": group.endLoc,
            "fill": "red",
            "stroke": "black",
            "height": 5,
            "width": groupWidth / 2,
            "transform": "translate(" + groupWidth / 4 + ", " + (jxnWrapperHeight - 6) + ")"
          }).on("dblclick", function() {
            if (selectedIsoform.index == this.parentNode.getAttribute("ActiveIsoform")) {
              if (selectedIsoform == expandedIsoform) {
                collapseIsoform(selectedIsoform);
              }
              else {
                expandIsoform(selectedIsoform);
                sortDots(this.parentNode);
              }
            }
          })

          var anchorX = startX + (groupInd + 0.5) * groupWidth;
          linesGroup.append("line").attr({
            "type": "acceptor",
            "anchorX": anchorX,
            "x1": anchorX,
            "x2": getBucketAt(group.endLoc).xStart,
            "startLoc": group.startLoc,
            "endLoc": group.endLoc,
            "y1": jxnWrapperHeight,
            "y2": getDonorY(),
            "class": "edgeConnector",
            "stroke": "red"
          })

          linesGroup.append("line").attr({
            "type": "donor",
            "anchorX": anchorX,
            "x1": anchorX,
            "x2": getBucketAt(group.startLoc).xEnd,
            "startLoc": group.startLoc,
            "endLoc": group.endLoc,
            "y1": jxnWrapperHeight,
            "y2": getDonorY(),
            "class": "edgeConnector",
            "stroke": "blue"
          }).style({
            "visibility": "hidden"
            })

          var boxPlotData = new Array(sampleLength);
          var nonZeroStartIndex = sampleLength - (group.end - group.start + 1);
          for (var i = 0; i < sampleLength; i++) {
            if (i < nonZeroStartIndex)
              boxPlotData[i] = 0;
            else
              boxPlotData[i] = jxnsData.weights[group.start + i - nonZeroStartIndex].weight;
          }
          var boxplotData = computeBoxPlot(boxPlotData, 1);
          var boxplot = createBoxPlot(groupNode, "boxplot",
            boxplotData.whiskerDown, boxplotData.whiskerTop, boxplotData.Q).attr({
              "transform": " translate(" + groupWidth / 2 + ", 0)",
            }).style({
            });

          var dotsGroup = groupNode.append("g");
          for (var ind = group.start; ind <= group.end; ind++) {
            var jxnData = jxnsData.weights[ind];
            var jxnCircle = dotsGroup.append("circle").attr({
              "class": "jxnCircle",
              "sourceExonInd": jxnData.start,
              "targetExonInd": jxnData.end,
              "data-sample": jxnData.sample,
              "r": jxnCircleRadius,
              "cx": groupWidth / 2,
              "cy": yScaleContJxn(jxnData.weight),
              "outlier": jxnData.weight < boxplotData.whiskerDown || jxnData.weight > boxplotData.whiskerTop,
              "fill": function (d, i) {
                return defaultDotColor
              }
            })
            jxnCircle.on('mouseover', function () {
              var hoveredSample = this.getAttribute("data-sample");
              d3.selectAll('.jxnCircle').style('fill', function () {
                var sample = this.getAttribute("data-sample");
                return (sample == hoveredSample) ? highlightedDotColor : dehighlightedDotColor;
              });
            }).on('mouseout', function (val, dotInd, plotInd) {
              d3.selectAll('.jxnCircle')
                .transition()
                .duration(100)
                .style('fill', defaultDotColor);

            });

            jxnCircle.append("svg:title")
              .text(function (d, i) {
                return jxnData.sample + ": " + jxnData.weight + " (" + jxnData.start + " - " + jxnData.end + ")";
              });

          }

        })


        startX += groupWidth * jxnGroups[jxnGpInd].groups.length + jxnWrapperPadding;
      }

      linesGroup.each(function() {
        this.parentNode.appendChild(this);
      })
    }

    function updateDotVisibility() {
      d3.selectAll(".jxnCircle").style({
        "visibility": function(d, i) {
          return showAllDots  || (this.getAttribute("outlier") == "true") ? "visible" : "hidden";
          // this.getAttribute("outlier") ? "visible" : "hidden";
        }
      })

    }

    function updateDotJitter() {
      d3.selectAll(".jxnCircle").attr({
        "transform": function(d, i) {
          var xShift = jitterDots ? 4 - 8 * Math.random() : 0;
          return "translate(" + xShift + ", 0)"
        }
      })
    }

    function drawRNA(RNAArea) {

      RNAArea.append("line").attr({
        "x1": axis.genePosToScreenPos(startCoord),
        "x2": axis.genePosToScreenPos(endCoord),
        "y1": RNAHeight,
        "y2": RNAHeight,
        "class": "RNALine",
        "stroke": "#666"
      });

      buckets = new Array(jxnsData.all_starts.length + jxnsData.all_ends.length);
      for (var i = 0; i < buckets.length; ++i) {
        if(i < jxnsData.all_starts.length) {
          var loc = jxnsData.all_starts[i];
          buckets[i] = {
          "type" : "donor",
          "loc": loc,
          "xStart": 0,
          "xEnd": 0,
          "xStartDesired": 0,
          "xEndDesired": 0,
          "firstGroupBucket": i,
          "lastGroupBucket": i
          }
        }
        else {
          var loc = jxnsData.all_ends[i - jxnsData.all_starts.length];
          buckets[i] = {
          "type" : "receptor",
          "loc": loc,
          "xStart": 0,
          "xEnd": 0,
          "xStartDesired": 0,
          "xEndDesired": 0,
          "firstGroupBucket": 0,
          }
        }
      }
      buckets.sort(function (a, b) {return a.loc < b.loc ? -1 : a.loc == b.loc ? 0 : 1});

      computeFlagPositions()

      var RNASites = RNAArea.selectAll(".RNASites").data(buckets);
      RNASites .exit().remove();

      var triangles = RNASites.enter().append("polyline").attr({
        "class": "RNASites",
        "fill": function (d, i) {return d.type == "donor" ? "blue" : "red"},
        "stroke": "black",
        "points": function (d, i) {
          return d.type == "donor" ? [
            0, RNAHeight/2,
            triangleLength, RNAHeight/2 - 5,
            triangleLength, RNAHeight/2 + 5,
            0, RNAHeight/2] :
            [
            triangleLength, RNAHeight/2,
            0, RNAHeight/2 - 5,
            0, RNAHeight/2 + 5,
            triangleLength, RNAHeight/2
          ]
        },
        "transform": function(d, i) {return "translate(" + d.xStart + ",0)"}
      })

      triangles.append("svg:title")
        .text(function (d, i) {
          return d.loc;
        });


      triangles.on('mouseover', function (d1, i1) {

        if (selectedIsoform != null)
          return;

        RNAArea.selectAll(".RNASites, .RNASiteConnector").each(function (d2, i2) {
          d3.select(this).style({
            "opacity" : d1 == d2 ? 1 : 0.1
          })
        })

        d3.selectAll(".JXNAreaConnector").each(function() {
          d3.select(this).style({
            "opacity" : (this.getAttribute("loc") == d1.loc) ? 1 : 0.1
          })
        })

        d3.selectAll(".edgeAnchor, .edgeConnector").each(function() {
          var classAttr = this.getAttribute("class");
          var startLoc = this.getAttribute("startLoc");
          var endLoc = this.getAttribute("endLoc");
          if (startLoc != d1.loc &&  endLoc != d1.loc) {
            d3.select(this).style({"opacity" : 0.1})
          }
          else if (classAttr == "edgeConnector") {
            var otherLoc = startLoc == d1.loc ? endLoc : startLoc;
            RNAArea.selectAll(".RNASites, .RNASiteConnector").each(function (d2) {
              if (d2.loc == otherLoc) {
                d3.select(this).style({"opacity" : 1})
              }
            })
            d3.selectAll(".JXNAreaConnector").each(function (d2) {
              if (this.getAttribute("loc") == otherLoc) {
                d3.select(this).style({"opacity" : 1})
              }
            })
          }
        })

      }).on('mouseout', function () {
        if (selectedIsoform != null)
          return;


        d3.selectAll(".RNASites, .JXNAreaConnector, .RNASiteConnector, .edgeAnchor, .edgeConnector").style({
            "opacity" : 1
        })
      });

      RNASites.enter().append("polyline").attr({
        "class": "RNASiteConnector",
        "fill":"none",
        "stroke": function (d, i) {return d.type == "donor" ? "blue" : "red"},
        "points": function (d, i) {
          var x1 =  d.type == "donor" ? d.xEnd : d.xStart;
          return [
            x1, (RNAHeight + triangleLength)/2,
            x1, RNAHeight/2 + triangleLength,
            axis.genePosToScreenPos(d.loc), RNAHeight,
          ]
        }
      })

  }


      function computeFlagPositions() {
        // compute desired positions
        for (var i = 0; i < buckets.length; ++i) {
          var axisLoc = axis.genePosToScreenPos(buckets[i].loc);
          if(buckets[i].type == "donor") {
            buckets[i].xStart = buckets[i].xStartDesired = axisLoc - triangleLength;
            buckets[i].xEnd = buckets[i].xEndDesired = axisLoc;
          }
          else {
            buckets[i].xStart = buckets[i].xStartDesired = axisLoc;
            buckets[i].xEnd = buckets[i].xEndDesired = axisLoc + triangleLength;
          }
        }

        for (var i = 1; i < buckets.length; ++i) {
          buckets[i].firstGroupBucket = i;
          var ind = i;
          var shift = -1;
          while(shift < 0 && ind > 0 && (buckets[ind].xStart < buckets[ind - 1].xEnd + sitePadding)) {
            var firstInd = buckets[ind - 1].firstGroupBucket;
            var overlap = buckets[ind - 1].xEnd + sitePadding - buckets[ind].xStart;
            for (var j = ind; j <= i ; ++j) {
              buckets[j].xStart += overlap
              buckets[j].xEnd += overlap
              buckets[j].firstGroupBucket = firstInd
            }
            var leftGap = buckets[firstInd].xStartDesired - buckets[firstInd].xStart;
            var rightGap = buckets[i].xStart - buckets[i].xStartDesired;
            shift = (leftGap - rightGap) / 2;
            shift = Math.min(shift, axis.genePosToScreenPos(endCoord) - buckets[i].xStart)
            for (var j = firstInd; j <= i ; ++j) {
              buckets[j].xStart += shift
              buckets[j].xEnd += shift
            }
            ind = firstInd;
          }
        }
      }



      function getJxnsFromSpan(data, curExon, otherExon) {
      var jxns = [];
      for (var sample in data.samples) {
        data.samples[sample]["jxns"].forEach(function(jxn, i) {
          if ((curExon[1] == jxn[0][0] && otherExon[0] == jxn[0][1]) ||
            (otherExon[1] == jxn[0][0] && curExon[0] == jxn[0][1])) {
            jxns.push(jxn[1]);
          }
        });
      }
      return jxns
    }

    function computeBoxPlot(values) {
      var sortedJxns = values.sort(d3.ascending);
      var Q = new Array(5);
      Q[0] = d3.min(sortedJxns);
      Q[4] = d3.max(sortedJxns);
      Q[1] = d3.quantile(sortedJxns, 0.25);
      Q[2] = d3.quantile(sortedJxns, 0.5);
      Q[3] = d3.quantile(sortedJxns, 0.75);
      var iqr = 1.5 * (Q[3] - Q[1]);
      var whiskerTop, whiskerDown;
      {
        var i = -1;
        var j = sortedJxns.length;
        while ((sortedJxns[++i] < Q[1] - iqr));
        while (sortedJxns[--j] > Q[3] + iqr);
        whiskerTop = j == sortedJxns.length - 1 ? sortedJxns[j] : Q[3] + iqr;
        whiskerDown = i == 0 ? sortedJxns[i] : Q[1] - iqr;
      }
      return {"whiskerTop": whiskerTop, "whiskerDown": whiskerDown, "Q": Q};
    }

    function createSubBoxPlots(parent, data, groups) {
      var transformation;
      var parentNode = d3.select(parent);
      parentNode.selectAll(".jxnContainer").each(function() {
          transformation = this.getAttribute("transform")
        })

      var effectiveWidth = getExpandJxnWidth() -  jxnBBoxWidth;
      var subplotsContainer = parentNode.select(".subboxplots");

      var curExon = curExons[parent.getAttribute("sourceExonInd")];
      var otherExon = curExons[parent.getAttribute("targetExonInd")];
      for (var gr = 0; gr < groups.length; gr++) {
        var jxns = []

        for (var sInd in groups[gr].samples) {
          var sample = groups[gr].samples[sInd];
          data.samples[sample]["jxns"].forEach(function(jxn, i) {
            if ((curExon[1] == jxn[0][0] && otherExon[0] == jxn[0][1]) ||
              (otherExon[1] == jxn[0][0] && curExon[0] == jxn[0][1])) {
              jxns.push(jxn[1]);
            }
          });
        }
        var boxplotData = computeBoxPlot(jxns);
        var xShift = jxnBBoxWidth / 2 + effectiveWidth * (gr + 1) / (groups.length + 1);
        var boxplot = createBoxPlot(subplotsContainer, "subboxplot",
          boxplotData.whiskerDown, boxplotData.whiskerTop, boxplotData.Q).attr({
          "transform": transformation +
          " translate(" + xShift + ", 0)"
        }).style({
            "opacity": 0
          });
        boxplot.selectAll(".jxnBBox").style({
          "fill" : groups[gr].color
        })
        boxplot.transition().duration(400).style({
            "opacity": 1
          });
        parentNode.selectAll(".jxnCircle").filter(function () {
          return groups[gr].samples.indexOf(this.getAttribute("data-sample")) >= 0
        }).transition().duration(400).attr({
          "cx": function(d, i) {
            return xShift
          },
          "transform" : transformation
        })

      }
    }

    function createBoxPlot(container, boxplotClass, whiskerDown, whiskerTop, Q) {
      var boxplot = container.append("g").attr({
        "class": boxplotClass
      });
      boxplot.append("line").attr({
        "class": "boxPlotLine",
        "stroke": "black",
        "stroke-dasharray": "5,5",
        "x1": 0,
        "x2": 0,
        "y1": yScaleContJxn(whiskerDown),
        "y2": yScaleContJxn(whiskerTop)
      })

      boxplot.append("rect").attr({
        "class": "jxnBBox",
        "fill": "white",
        stroke: "black",
        "height": Math.abs(yScaleContJxn(Q[3]) - yScaleContJxn(Q[1])),
        "width": jxnBBoxWidth,
        "transform": "translate(" + (-jxnBBoxWidth / 2) + "," + yScaleContJxn(Q[3]) + ")"
      })

      boxplot.append("line").attr({
        "class": "boxPlotQLine",
        "x1": -jxnBBoxWidth / 2,
        "x2": jxnBBoxWidth / 2,
        "y1": yScaleContJxn(Q[1]),
        "y2": yScaleContJxn(Q[1]),
        "stroke": "#666"
      })

      boxplot.append("line").attr({
        "class": "boxPlotQLine",
        "x1": -jxnBBoxWidth / 2,
        "x2": jxnBBoxWidth / 2,
        "y1": yScaleContJxn(Q[2]),
        "y2": yScaleContJxn(Q[2]),
        "stroke": "#666"
      })

      boxplot.append("line").attr({
        "class": "boxPlotQLine",
        "x1": -jxnBBoxWidth / 2,
        "x2": jxnBBoxWidth / 2,
        "y1": yScaleContJxn(Q[3]),
        "y2": yScaleContJxn(Q[3]),
        "stroke": "#666"
      })

      boxplot.append("line").attr({
        "class": "boxPlotQLine",
        "x1": - jxnBBoxWidth / 2,
        "x2": jxnBBoxWidth / 2,
        "y1": yScaleContJxn(whiskerTop),
        "y2": yScaleContJxn(whiskerTop),
        "stroke": "#666"
      })

      boxplot.append("line").attr({
        "class": "boxPlotQLine",
        "x1": - jxnBBoxWidth / 2,
        "x2": + jxnBBoxWidth / 2,
        "y1": yScaleContJxn(whiskerDown),
        "y2": yScaleContJxn(whiskerDown),
        "stroke": "#666"
      })

      return  boxplot;

    }

    function expandJxn(boxPlotGroup, callback) {

      var jxnWrapper = boxPlotGroup.parentNode;

      jxnWrapper.parentNode.appendChild(jxnWrapper);

      var parentNode = d3.select(boxPlotGroup);
      parentNode.selectAll(".jxnContainer").attr({
        "width": expandedWidth,
      }).style({"visibility": "visible"})
        .transition().duration(300).style({
        "opacity": 1,
      }).each("end", callback);

      var boxplots = parentNode.selectAll(".boxplot");

/*      boxplots.transition().duration(400).attr({
        "transform": transformation,
      });
      boxplots.selectAll(".boxPlotQLine").
        style({"stroke-dasharray": "5,5"})
        .transition().duration(400).attr({"x2": containerWidth});
*/

//      boxPlotGroup.selectAll(".boxPlotLine").style({
//        "visibility": "hidden"
//      });
    }

    function removeSubboxplots(parentNode) {
      parentNode.selectAll(".subboxplot").transition().duration(400).style({
        "opacity":0
      })
        .each("end", function() {
          d3.select(this).remove()
        })

    }

    function collapseJxn(parentNode, callback) {

      parentNode.transition().duration(200).attr({
        "transform": function() {
          return  "translate(" + this.getAttribute("startX") + ", 0)"
        }
      })

      parentNode.selectAll(".jxnContainer").transition().duration(400).style({
        "opacity": 0,
      }).each("end", callback);

      // removeSubboxplots(parentNode)

      // var boxplots = parentNode.selectAll(".boxplot");

/*      boxplots.selectAll(".boxPlotQLine")
        .transition().duration(400).attr({"x2": jxnBBoxWidth / 2}).each("end", function() {
          d3.select(this).style({"stroke-dasharray": ""})
        });
*/
      parentNode.selectAll(".jxnCircle").transition().duration(400).attr({
        "cx": groupWidth / 2,
        "transform": ""
      })
//      parentNode.transition().delay(400).selectAll(".boxPlotLine").style({
//        "visibility": "visible"
//      });

    }

    function expandIsoform(isoform, sortBy) {

      var numOfJunctions = allIsoforms[isoform.isoform].exons.length - 1;

      var availableWidth = width - weightAxisCaptionWidth - jxnWrapperPadding;
      var expandedSpace = Math.min(200, availableWidth / numOfJunctions);

      var totalWidth = expandedSpace * numOfJunctions;

      var activeEdgeGroups = d3.selectAll(".edgeGroup").filter(function () {
        return this.getAttribute("ActiveIsoform") == isoform.index}
      ).sort(function(a, b) {
          return a.start < b.start ? -1 : 1
        });

      var leftMostGroupX = width, rightMostGroupX = 0;

      activeEdgeGroups.each(function (d) {
        console.log("Group: " + d.start + " - " + d.end)
        var x = parseInt(this.getAttribute("startX"));
        leftMostGroupX = Math.min(leftMostGroupX, x);
        rightMostGroupX = Math.max(rightMostGroupX, x);
      })

      var startX = (rightMostGroupX + leftMostGroupX  + expandedSpace - totalWidth) / 2
      startX = Math.min(startX, availableWidth - totalWidth)
      startX = Math.max(startX, weightAxisCaptionWidth + jxnWrapperPadding)
      expandedWidth = expandedSpace - 2 * jxnBBoxWidth;
      activeEdgeGroups.each(function(d, i) {
        d3.select(this).transition().duration(200).attr({
          "transform": function() {
            return "translate(" + (startX + i * expandedSpace) + ", 0)"
          }
        }).each("end", function() {
          expandJxn(this);
        })
        var startLoc = this.getAttribute("startLoc");
        var endLoc = this.getAttribute("endLoc");
        d3.selectAll(".edgeConnector").filter(function () {
          return startLoc == this.getAttribute("startLoc") &&
          endLoc == this.getAttribute("endLoc");
        }).transition().duration(200).attr({
          "x1":  startX + i * expandedSpace + groupWidth / 2
        });

      })
      expandedIsoform = isoform;
    }

    function createGroups(activeIsoform, data) {
      d3.selectAll(".boxplotWithDots").each(function () {
        if (this.getAttribute("ActiveIsoform") == activeIsoform) {
          removeSubboxplots(d3.select(this));
          if (showDotGroups && (groups.length > 0)) {
            createSubBoxPlots(this, data, groups);
          }
          else {
            sortDots(this)
          }
        }
      })
    }

    function collapseIsoform(isoform, callback) {
    var selection = d3.selectAll(".edgeGroup").filter(function (d, i) {
      return this.getAttribute("ActiveIsoform") == isoform.index;
    })
    var size = 0;
    selection.each(function() { size++; });
    selection.each(function (d, i) {
      var parentNode = d3.select(this)

      collapseJxn(parentNode, function () {
        parentNode.selectAll(".jxnContainer").style({
          "visibility": "hidden",
        })
        if ((i == size - 1) && callback)
          callback()
      })
    })
    d3.selectAll(".edgeConnector").transition().duration(200).attr({
        "x1":  function() {
          return this.getAttribute("anchorX");
        }
    });
    expandedIsoform = null;
  }

    function getExpandJxnWidth() {
      var axis = that.axis;
      var jxnWidth = width;
      var x1 = (axis.getXPos(curExons[0][0]) + axis.getXPos(curExons[0][1])) / 2;

      for (i = 1; i < curExons.length; i++) {
        var x2 = (axis.getXPos(curExons[i][0]) + axis.getXPos(curExons[i][1])) / 2;
        if (x2 - x1 < jxnWidth)
          jxnWidth = x2 - x1;
        x1 = x2;
      }
      return jxnWidth - 4 * isoformEdgePadding - jxnBBoxWidth;
    }

    function deSelectIsoforms() {
      d3.selectAll(".edgeConnector").style({
        "visibility": function() {
          return this.getAttribute("type") == "donor" ? "hidden" : "visible"
        }
      })
      d3.selectAll(".RNASites, .RNASiteConnector, .JXNAreaConnector, .jxnWrapperBox, .edgeAnchor, .edgeConnector, .edgeGroup")
        .transition().duration(200).style({
          "opacity" : 1,
        })
      selectedIsoform =  null;
    }

    function selectIsoform(data) {
      if (data.index == -1) {
        deSelectIsoforms();
        return;
      }

      d3.selectAll(".jxnWrapperBox").
        transition().duration(300).style({
          "opacity" : 0.1
        })

      d3.selectAll(".RNASites, .RNASiteConnector, .JXNAreaConnector, .edgeAnchor, .edgeConnector, .edgeGroup").style({
        "opacity" : 0.1,
      })

      var exonIDs = allIsoforms[data.isoform].exons;

      var lastExonEnd = -1;
      for (var exonInd = 0; exonInd < exonIDs.length; exonInd++) {
        var exon = allExons[exonIDs[exonInd]]

//        console.log(exon.start + "- " + exon.end);

        d3.selectAll(".RNASites, .RNASiteConnector").filter(function (d) {
          return d.loc == exon.start || d.loc == exon.end
        }).style({
          "opacity": 1,
        })

        d3.selectAll(".edgeAnchor, .edgeConnector, .edgeGroup").filter(function () {
          var startLoc = this.getAttribute("startLoc");
          var endLoc = this.getAttribute("endLoc");
          var include = startLoc == lastExonEnd && endLoc == exon.start
          if (include && this.getAttribute("class") == "edgeGroup") {
            d3.select(this).attr({
              "ActiveIsoform": data.index
            })
          }
          return include;
        }).style({
          "opacity": 1,
          "visibility": "visible"
        })

        lastExonEnd = exon.end;
      }

          /* .each(function() {
          var classAttr = this.getAttribute("class");
          var startLoc = this.getAttribute("startLoc");
          var endLoc = this.getAttribute("endLoc");

          if (startLoc != d1.loc &&  endLoc != d1.loc) {
            d3.select(this).style({"opacity" : 0.1})
          }
          else if (classAttr == "edgeConnector") {
            var otherLoc = startLoc == d1.loc ? endLoc : startLoc;
            RNAArea.selectAll(".RNASites, .RNASiteConnector").each(function (d2) {
              if (d2.loc == otherLoc) {
                d3.select(this).style({"opacity" : 1})
              }
            })
            d3.selectAll(".JXNAreaConnector").each(function (d2) {
              if (this.getAttribute("loc") == otherLoc) {
                d3.select(this).style({"opacity" : 1})
              }
            })
          }
        })
        */
      selectedIsoform = data;
    }

    function sortDots(parentNode) {

      var isoformInd = parentNode.getAttribute("ActiveIsoform");

      var indices = new Array(sampleLength);
      d3.select(parentNode).each(function(d, i) {
        var arrayLen = d.end - d.start + 1;
        var shift = sampleLength - arrayLen;
        for (var ind = d.start; ind <= d.end; ind++) {
          indices[jxnsData.weights[ind].sample] = shift + (ind - d.start);
        }
      })


/*      var indices = [];
      for (var i = 0; i < activeJxnWeights.length; ++i) indices.push(i);
        indices.sort(function (a, b) { return activeJxnWeights[a] < activeJxnWeights[b] ? -1 : 1; });
 */

      xJxnBoxScale.domain([0, indices.length - 1]).range([jxnBBoxWidth + 3 * dotRadius, expandedWidth + groupWidth / 2 - 3 * dotRadius])

      var newKeysCount = 0;

      d3.selectAll(".edgeGroup").filter(function() {
        return this.getAttribute("ActiveIsoform") == isoformInd;
      }).each(function() {
        var thisNode = d3.select(this);


        thisNode.selectAll(".jxnCircle").transition().duration(400).attr({
          "cx": function(d, i) {
            var dataSample = this.getAttribute("data-sample");
            if (indices[dataSample] === undefined ) {
              indices[dataSample] = newKeysCount++;
            }
            return xJxnBoxScale(indices[dataSample])
          },
        })

/*        var axis = that.axis;
        var srcMid = (axis.getXPos(curExons[srcExonInd][0]) + axis.getXPos(curExons[srcExonInd][1])) / 2;
        var targetMid = (axis.getXPos(curExons[targetExonInd][0]) + axis.getXPos(curExons[targetExonInd][1])) / 2;
        var plotMid = (srcMid + targetMid) / 2;



 */
      })
    }

    //globalCallCount = 1;

    gui.current.addUpdateEvent(updateVisualization)
    //updateVisualization();
    return head.node();
  };

  exports.GenomeVis = GenomeVis;
  exports.create = create;
});
