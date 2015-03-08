/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/25/15.
 */

define(['exports','d3'], function(exports, d3){

  function AltSpliceGUI(){
    var that = this;

    this.geneSelector = d3.select("#geneSelect");

    this.chromIDDiv = d3.select("#chromosomeInfo");

    this.startPosDiv = d3.select("#startPos");

    this.baseWidthInputDiv = d3.select("#baseWidth").attr({
      type:"text",
      value:"1500"
    })

    this.allVisUpdates= [];


    this.init = function (genomeDataLink) {
      that.genomeDataLink = genomeDataLink;
    }


    this.populateGeneData= function(geneID){
      console.log("pop", geneID);

      that.genomeDataLink.getAllGenes().then(function(geneData){
        $(that.chromIDDiv.node()).val(geneData[geneID].chromID);
        $(that.startPosDiv.node()).val(geneData[geneID].tx_start);

        //observer
        that.allVisUpdates.forEach(function (update) {
          update();
        })
      })

    }


    this.start = function(){
      that.genomeDataLink.getAllGenes().then( function(genes) {
        //geneData = genes;
        for (var gene in genes) {
          that.geneSelector.append("option").attr('value', gene).text(gene);
        }
        that.populateGeneData($(that.geneSelector.node()).val());

        // activate GeneSelector
        that.geneSelector.on({
          "change": function(gene){that.populateGeneData($(that.geneSelector.node()).val())}
        })

      });


    }



    this.getSelectedGene = function(){
      return $(that.geneSelector.node()).val();
    }


    this.addUpdateEvent= function(updateFunction){
      that.allVisUpdates.push(updateFunction);
    }


    this.getStartPos = function()  {
      return parseInt($(that.startPosDiv.node()).val())
    }

    this.getBaseWidth = function()  {
      return  parseInt($(that.baseWidthInputDiv.node()).val())
    }



  }






  var globalGUI = new AltSpliceGUI();

  exports.AltSpliceGUI = AltSpliceGUI;
  exports.current = globalGUI;


  //exports.geneSelector = globalGUI.geneSelector;
  //exports.init = globalGUI.init;
  //exports.start = globalGUI.start;
  //exports.allVisUpdates = globalGUI.allVisUpdates;




})
