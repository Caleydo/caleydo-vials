
/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 8/9/15.
 * Based on work by Bilal Alsallakh and Joseph Botros
 */


define(['exports', 'd3','underscore','./vials-gui', '../caleydo_core/event','vials-helper'], function (exports, d3, _ , gui, event, helper) {
  /**
   * a simple template class of a visualization. Up to now there is no additional logic required.
   * @param data
   * @param parent
   * @constructor
   */
  function VialsJunctionVis(data, parent) {
    this.data = data;
    this.parent = parent;
    this.node = this.build(d3.select(parent));
  }

  /**
   * factory method of this module
   * @param data the data to show
   * @param parent the parent dom element to append
   * @returns {VialsJunctionVis} the visualization
   */
  function create(data, parent) {
    return new VialsJunctionVis(data, parent);
  }

  // GLOBAL VARIABLES & STATUS
  var margin = {top: 40, right: 150, bottom: 20, left: 150};
  var fullHeight = 370;
  var height = fullHeight - margin.top - margin.bottom;

  var abundancePlot={
    height:200,
    prefix:"jxn_weight",
    y:0,
    panels:{
      prefix:"jxn_weight_panel",
      minWidth:15,
      panelGapsize:4,
      scatterWidth:100,
      //dynamic paramters:
      currentWidth:-1
    }

  }

  var connectorPlot={
    height:100,
    prefix:"jxn_con",
    y:abundancePlot.height,
    upperConnectors:{
      height:60,
      prefix:"jxn_con_upper",
      y:0
    },
    triangles:{
      height:8,
      y:60,
      prefix:"jxn_con_triangle"
    }
    ,
    lowerConnectors:{
      height:100-(60+8),
      prefix:"jxn_con_lower",
      y:60+8
    }
  }

  var heatmapPlot = {
    height:15,
    prefix:"jxn_heat",
    y:abundancePlot.height+connectorPlot.height
  }


  /**
   * build the vis and return node
   * @param $parent - the d3 selection of parent node
   * @returns {Node} the node
   */
  VialsJunctionVis.prototype.build = function ($parent) {

    /*
     ================= INIT =====================
     */


    //-- initial parametrization:
    var that = this;
    var axis = that.data.genomeAxis;
    var width = axis.getWidth();

    // data var:
    var allData = {}; // api data
    var triangleData = []; // data to draw triangles
    var allJxns = {}; // juncntion information as map
    var sampleOrder = []; // sort order for elements in scatterplot view (abundance)
    var jxnGroups = []; // end positions of jxn groups for connector drawing

    //visual variables:
    var weightScale = d3.scale.linear().range([abundancePlot.height-10,5]);




    //--  create the outer DOM structure:
    var head = $parent.append("div").attr({
      "class":"gv"
    })
    var svg = head.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style({
        "left":"20px",
        "position":"relative"
      })

    //--  create textLabel and retrieve its width
    var textLabelPadding = helper.drawSideLabel(svg, height, margin,'center');

    //--  create a group offset by the label
    var svgMain = svg.append("g").attr({
      "class": "jxnMain",
      "transform": "translate(" + textLabelPadding + ",0)"
    });

    abundancePlot.g = svgMain.append("g").attr({
      "transform":"translate("+0 + "," + abundancePlot.y + ")",
      "class":abundancePlot.prefix+"_group"
    });


    heatmapPlot.g = svgMain.append("g").attr({
      "transform":"translate("+0 + "," + heatmapPlot.y + ")",
      "class":heatmapPlot.prefix+"_group"
    });

    var crosshairGroup = svgMain.append("g").attr({
      "transform":"translate("+0 + "," + heatmapPlot.y + ")",
      "class":"crosshair_group"
    });

    connectorPlot.g =  svgMain.append("g").attr({
      "transform":"translate("+0 + "," + connectorPlot.y + ")",
      "class":connectorPlot.prefix+"_group"
    });

    ["triangles","upperConnectors","lowerConnectors"].forEach(function(subGroup){
      connectorPlot[subGroup].g = connectorPlot.g.append("g").attr({
        "transform":"translate("+0 + "," + connectorPlot[subGroup].y + ")",
        "class":connectorPlot[subGroup].prefix+"_group"
      });
    });


    function initView(){

      // create crosshair
      crosshairGroup.append("line").attr({
        "class":"crosshair",
        "x1":0,
        "y1":0,
        "x2":0,
        "y2":fullHeight-heatmapPlot.y
      }).style({
        "stroke-width":"1",
        "stroke":"black",
        "pointer-events":"none"
      });

      crosshairGroup.append("text").attr("class", "crosshairPos")

      var currentX = 0;
      heatmapPlot.g.on("mousemove", function () {
        currentX = d3.mouse(this)[0];
        //console.log("mouse", currentX);
        event.fire("crosshair", currentX);

      })

    }



    /*
    ================= DRAW METHODS =====================
     */



    function updateCrosshair(event, x){
      var visible = (x < 0 || x > axis.getWidth()) ? "hidden" : "visible";

      crosshairGroup.selectAll(".crosshair").attr({
        "x1":x,
        "x2":x,
        "visibility":visible
      })

      d3.selectAll(".crosshairPos")
        .text(function(d) {return axis.screenPosToGenePos(x)})
        .each(function() {
          var self = d3.select(this),
            bb = self.node().getBBox();
          self.attr({
            "x": x + 10,
            "y": fullHeight-heatmapPlot.y - bb.height/2,
            "visibility":visible
          });
        })
    }


    // -- HEATMAP PLOT --
    function updateHeatmap() {
      // bind local data
      var allIsoforms = allData.gene.isoforms;
      var allExons = allData.gene.exons;
      var heatMapGroup = heatmapPlot.g;

      // collect exons:
      var collectExons = []
      Object.keys(allIsoforms).forEach(function (key) {
        allIsoforms[key].exons.forEach(function (exon) {
          collectExons.push(allExons[exon])
        })
      })

      // --- D3 update cycle
      var exonHeat = heatMapGroup.selectAll(".exon").data(collectExons);
      exonHeat.exit().remove();

      // --- adding Element to class exon
      var exonHeatEnter = exonHeat.enter().append("rect").attr({
        "class": heatmapPlot.prefix+" exon",
        y: 0,
        height: heatmapPlot.height
      })

      // --- changing attr for exon
      exonHeat.attr({
        x: function (d) {
          return axis.genePosToScreenPos(d.start);
        },
        width: function (d) {
          return axis.genePosToScreenPos(d.end) - axis.genePosToScreenPos(d.start);
        }
      })






    }





    /**
     * update flag drawing
     * hidden option is boolean for animation = false
     */
    function updateFlags() {

      var animate = arguments[0] || false;
      var triangleLength = connectorPlot.triangles.height;
      var positiveStrand = allData.gene.strand === '+';

      var triangles = connectorPlot.triangles.g.selectAll(".triangle").data(triangleData);
      triangles.exit().remove();

      triangles.enter().append("polygon").attr({
        "transform":"translate("+0+","+0+")"
      }).on({
        "mouseover":function(d){
          event.fire("crosshair", axis.genePosToScreenPos(d.loc));
        }
      })

      triangles.attr({
        "class": function(d){return connectorPlot.triangles.prefix+" triangle "+ d.type;},
        "points": function (d, i) {
          return isLeftArrow(d.type, positiveStrand)?
            [
              0, triangleLength/2,
              triangleLength, 0,
              triangleLength, triangleLength
            ] : [
            triangleLength, triangleLength/2,
            0, 0,
            0, triangleLength
          ]
        }
      })

      var trans = triangles;
      if (animate) trans = triangles.transition();

      trans.attr({
        "transform": function(d, i) {return "translate(" + d.xStart + ",0)"}
      })

    }

    function updateConnectors(){
      var triangleLength = connectorPlot.triangles.height;
      var positiveStrand = allData.gene.strand === '+';


      /* -- update lower connectors - D3 circle -- */
      var lowerConnector = connectorPlot.lowerConnectors.g.selectAll(".con").data(triangleData);
      lowerConnector.exit().remove();

      lowerConnector.enter().append("polyline").attr({
        "class": connectorPlot.lowerConnectors.prefix+" con"
      })

      lowerConnector.attr({
        "points": function (d, i) {
          return [
            d.anchor, 0,
            d.anchor, triangleLength/2,
            axis.genePosToScreenPos(d.loc), connectorPlot.lowerConnectors.height
          ]
        }
      })



      // draw direct neighbors
      var directNeighors = connectorPlot.upperConnectors.g.selectAll(".neighborCon").data(jxnGroups.filter(function(d){return d.directNeighbor;}))
      directNeighors.exit().remove();

      directNeighors.enter().append("polygon").attr({
        "class":"neighborCon areaCon"
      })

      var h = connectorPlot.upperConnectors.height;
      directNeighors.transition().attr({
        points:function(d){
          var jxn = d.jxns[0];
          return [
            jxn.x+1,0,
            jxn.x+jxn.w-2,0,
            jxn.endTriangle.anchor,h,
            jxn.startTriangle.anchor,h
          ]

        }
      })


      // -- draw area connectors
      var areaConnectors = connectorPlot.upperConnectors.g.selectAll(".donorCon").data(jxnGroups.filter(function(d){return !d.directNeighbor;}))
      areaConnectors.exit().remove();

      areaConnectors.enter().append("polygon").attr({
        "class":"donorCon areaCon"
      })

      var h = connectorPlot.upperConnectors.height;
      var connector = (positiveStrand==axis.ascending)?'startTriangle':'endTriangle'

      areaConnectors.transition().attr({
        points:function(d){
          var jxn = d.jxns[0];
          return [
            jxn.x+1,0,
            d.endX,0,
            jxn[connector].anchor,h
          ]

        }
      })














    }

    function updateAbundanceView() {
      var allJxnArray = Object.keys(allJxns).map(function(key){return {
        key:key, jxn:allJxns[key]
      };})

      var panels =  abundancePlot.g.selectAll("."+abundancePlot.panels.prefix)
                        .data(allJxnArray,function(d){return d.key;})
      panels.exit().remove();

      // --- Enter:
      var panelsEnter = panels.enter().append("g").attr({
        class:abundancePlot.panels.prefix+" panel"
      })
      panelsEnter.append("rect").attr({
        class:"panelBG",
        height:abundancePlot.height
      }).on({
        "click":function(d){
          if (d.jxn.state=='std') d.jxn.state='plot';
          else d.jxn.state='std';
          event.fire("updateVis")
        }
      })

      // --- Updates:
      panels.transition().attr({
        "transform":function(d) {
          return "translate("+ d.jxn.x +","+0+")";
        }
      })
      panels.select(".panelBG").transition().attr({
        width: function(d){return d.jxn.w;}
      })





      var alldots = panels.selectAll(".dots").data(function(d){
        if (d.jxn.state == 'std'){
          var randomizer = helper.getPseudoRandom()
          res = d.jxn.weights.map(function(w){
            return {x: (d.jxn.w/4+randomizer()*d.jxn.w/2), w:w }
          })
          return res;

        }else if (d.jxn.state == 'plot'){
          var allConditions = Object.keys(allData.samples).length;
          res = d.jxn.weights.map(function(w,i){
            return {x: (i/allConditions*abundancePlot.panels.scatterWidth), w:w }
          })
          return res;
          //if (sampleOrder.length<1){
          //  //var weights = d.jxn.weights.map(function(w){return w.weight;})
          //
          //  var weights = _.sortBy(d.jxn.weights,function(w){return w.weight;} )
          //
          //
          //  return weights;
          //}


        }

      }, function(d){
        return d.w.sample;
      })

      alldots.exit().remove();

      alldots.enter().append("circle").attr({
          class:"dots",
          r:3
        })

      alldots.transition().attr({
        cx:function(d){return d.x;},
        cy:function(d){return weightScale(d.w.weight);}
      })
      
      
      
      
      
      
      
      
      




    }



    /*
     ================= LAYOUT METHODS =====================
     */


    function computeFlagPositions() {

      var triangleLength = connectorPlot.triangles.height;
      var sitePadding = triangleLength/3;

      var positiveStrand = allData.gene.strand === '+';

      // compute desired positions
      triangleData.forEach(function(triangle,i){
        var axisLoc = axis.genePosToScreenPos(triangle.loc);

        if (isLeftArrow(triangle.type, positiveStrand)){
          triangle.xStart = triangle.xStartDesired = axisLoc - triangleLength;
          triangle.xEnd = triangle.xEndDesired = axisLoc;
        }else{ // right arrow:
          triangle.xStart = triangle.xStartDesired = axisLoc;
          triangle.xEnd = triangle.xEndDesired = axisLoc + triangleLength;
        }

      })

      var bucketsCopy = triangleData.slice();

      if (!axis.ascending)
        bucketsCopy.reverse();

      // important to initialize this, as we start from i = 1
      bucketsCopy[0].firstGroupBucket = 0;

      for (var i = 1; i < bucketsCopy.length; ++i) {
        bucketsCopy[i].firstGroupBucket = i;
        var ind = i;
        var shift = -1;
        while (shift < 0 && ind > 0 && (bucketsCopy[ind].xStart < bucketsCopy[ind - 1].xEnd + sitePadding)) {
          var firstInd = bucketsCopy[ind - 1].firstGroupBucket;
          var overlap = bucketsCopy[ind - 1].xEnd + sitePadding - bucketsCopy[ind].xStart;
          for (var j = ind; j <= i; ++j) {
            bucketsCopy[j].xStart += overlap
            bucketsCopy[j].xEnd += overlap
            bucketsCopy[j].firstGroupBucket = firstInd
          }
          var leftGap = bucketsCopy[firstInd].xStartDesired - bucketsCopy[firstInd].xStart;
          var rightGap = bucketsCopy[i].xStart - bucketsCopy[i].xStartDesired;
          shift = (leftGap - rightGap) / 2;
          shift = Math.min(shift, axis.getWidth() - bucketsCopy[i].xStart)
          shift = Math.max(shift,  -bucketsCopy[firstInd].xStart)
          for (var j = firstInd; j <= i; ++j) {
            bucketsCopy[j].xStart += shift
            bucketsCopy[j].xEnd += shift
          }
          ind = firstInd;
        }
      }

      triangleData.forEach(function(b){
        b.anchor = isLeftArrow(b.type, positiveStrand) ? b.xEnd : b.xStart;
      })
    }


    function computeAbundanceLayout(){

      var gapSize=abundancePlot.panels.panelGapsize;
      var w = axis.getWidth();
      var positiveStrand = allData.gene.strand == '+'
      var allJXNsorted = Object.keys(allJxns).map(function (d) {return allJxns[d];});

      
      var elementWidth  = Math.max(w/allJXNsorted.length, abundancePlot.panels.minWidth);
      abundancePlot.panels.currentWidth = elementWidth;


      // start the layout here:
      var groupBy, groupBySecond;
      if (positiveStrand){
        groupBy = 'start';
        groupBySecond = 'end';
      }else{
        groupBy = 'end';
        groupBySecond = 'start';
      }

      // -- first sort the elements by start or end
      allJXNsorted.sort(function(a,b){
          var res =  d3.ascending(a[groupBy], b[groupBy]);
          if (res == 0) res = d3.ascending(a[groupBySecond], b[groupBySecond]);
          if (res == 0) res = d3.ascending(a.weight, b.weight)
          return res;
        }
      )


      var currentGroupCriterion = -1;
      var lastAddedJxn = null;
      var currentXPos = 0;
      jxnGroups = []; // clean the list
      var currentGroup = [];


      allJXNsorted.forEach(function(jxn){

        if (currentGroupCriterion==-1 || currentGroupCriterion== jxn[groupBy]){
          jxn.x =currentXPos;
          currentGroup.push(jxn);
        }else{
          jxnGroups.push({endX:currentXPos, directNeighbor:(lastAddedJxn.directNeighbor && currentGroup.length==1), jxns: currentGroup});
          currentXPos+=gapSize;
          jxn.x = currentXPos
          currentGroup = [jxn];
        }

        if (jxn.state=='std'){
          jxn.w = elementWidth;
        }else if (jxn.state=='plot'){
          jxn.w = abundancePlot.panels.scatterWidth;
        }

        currentXPos+= jxn.w;
        currentGroupCriterion= jxn[groupBy];

        lastAddedJxn = jxn;

      });

      // set start parameters// dont forget the last one :)
      jxnGroups.push({endX:currentXPos, directNeighbor:lastAddedJxn.directNeighbor, jxns: currentGroup});

      console.log("jxnGroups",jxnGroups);






      //TODO: find better solution for that
      svg.transition().attr("width",currentXPos+100);



      //console.log("allJXNsorted",allJXNsorted);


    }


    /*
     ================= HELPERMETHODS =====================
     */

    /**
     * a centralized method to decide if a flag is pointing left based on conditions
     * @param type - the site type (donor or receptor)
     * @param positiveStrand - boolean if on a positive strand
     * @returns {boolean}
     */
    function isLeftArrow(type, positiveStrand) {
      return type == ((positiveStrand || (!positiveStrand && !axis.ascending) ) ? "donor" : "receptor");
    }



    /*
     ================= GENERAL METHODS =====================
     */

    //var exploreArea = svgMain.append("g").attr("transform", "translate(0, 5)").attr("id","exploreArea");
    //jxnArea = exploreArea.append("g").attr("id", "jxnArea");


    function updateVis(){

      updateHeatmap();

      computeFlagPositions();
      updateFlags();


      computeAbundanceLayout();
      updateAbundanceView();

      updateConnectors();
    }



    function dataUpdate() {

      axis = that.data.genomeAxis;
      width = axis.getWidth();
      svg.attr("width", width + margin.left + margin.right+textLabelPadding)

      var curGene = gui.current.getSelectedGene();
      var curProject = gui.current.getSelectedProject();

      that.data.getGeneData(curProject, curGene).then(function (sampleData) {

        allData = sampleData;

        var positiveStrand = (sampleData.gene.strand ==='+');


        var jxns = sampleData.measures.jxns
        triangleData =
          jxns.all_starts.map(function(d,i){
            return {
              "type" : positiveStrand?"donor":"receptor",
              "loc": d,
              "xStart": 0,
              "xEnd": 0,
              "anchor": 0,
              "xStartDesired": 0,
              "xEndDesired": 0,
              "firstGroupBucket": i,
              "lastGroupBucket": i
            }
          }).concat(jxns.all_ends.map(function(d,i){
            return {
              "type" :  positiveStrand?"receptor":"donor",
              "loc": d,
              "xStart": 0,
              "xEnd": 0,
              "anchor": 0,
              "xStartDesired": 0,
              "xEndDesired": 0,
              "firstGroupBucket": 0
            }

          }));
        triangleData.sort(function (a, b) {return a.loc < b.loc ? -1 : a.loc == b.loc ? 0 : 1});



        var allJxnPos =[];
        allJxnPos = jxns.all_starts.map(function(d){return +d;}).concat(jxns.all_ends.map(function(d){return +d;}));
        allJxnPos.sort();

        weightScale.domain([0,1]);

        // generate a set of all distinct junctions
        allJxns = {};
        sampleData.measures.jxns.weights.forEach(function(jxn){
          var weight = +jxn.weight;
          var start = +jxn.start;
          var end = +jxn.end;
          var key = start+"_"+end;

          if (weightScale.domain()[1]<weight) weightScale.domain([0,weight]);

          var currentPos = allJxns[key];
          if (currentPos) currentPos.weights.push(jxn);
          else {
            allJxns[key] =
            {
              start:start,
              end:end,
              weights: [jxn],
              state: 'std', // or points, groups
              directNeighbor: end == allJxnPos[allJxnPos.indexOf(start) + 1], //  is it the special case ?
              startTriangle:triangleData[allJxnPos.indexOf(start)],
              endTriangle:triangleData[allJxnPos.indexOf(end)]
            };
          }
        })

        console.log("allJxnPos",allJxnPos);
        console.log("allJxns",allJxns);


        //cleanup
        sampleOrder = [];



        updateVis();

      });


    }


    event.on("newDataLoaded", dataUpdate);
    event.on("crosshair", updateCrosshair);

    event.on("updateVis", updateVis);


    initView();


    return head.node();
  }





  exports.VialsJunctionVis = VialsJunctionVis;
  exports.create = create;

});


