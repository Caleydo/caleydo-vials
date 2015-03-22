
require(['../caleydo/main','../caleydo/data', '../caleydo/vis', 'altsplice-gui', '../caleydo/event'], function (C,data, visPlugins, gui, event) {
  'use strict';
  var vis;

  data.create({
    type: 'genomeDataLink',
    name: 'AltSplice',
    serveradress: '/api/genomebrowser'
  }).then(function (genomeDataLink) {

    gui.current.init(genomeDataLink);

    var visses = visPlugins.list(genomeDataLink);

    //console.log(document.location.search.substring(1))

    var options = getJsonFromUrl();

    if (options.file){
      genomeDataLink.useFile(options.file);

    }


    var vis1Loaded = C.promised(function(resolve,reject){
      if (!options.mode || options.mode==='bilal' ){
        var junctionVis = visses.filter(function (vis) { return vis.id === 'altsplice-junctions'})[0];
        junctionVis.load().then(function (plugin) {
          vis = plugin.factory(genomeDataLink, document.querySelector("#vis1") );
          resolve();
        });
      }else{
        resolve();
      }
    })

    var vis2Loaded = C.promised(function(resolve,reject){
    if (!options.mode || options.mode==='joseph') {
        var readVis = visses.filter(function (vis) {
          return vis.id === 'altsplice-reads-simple'
        })[0];
        readVis.load().then(function (plugin) {
          vis = plugin.factory(genomeDataLink, document.querySelector("#vis2"));
          resolve();
        });
    }else{
      resolve();
    }
  });

    var vis3Loaded = C.promised(function(resolve,reject){
      if (!options.mode || options.mode==='hen') {
        var readVis = visses.filter(function (vis) {
          return vis.id === 'altsplice-isoforms'
        })[0];
        readVis.load().then(function (plugin) {
          vis = plugin.factory(genomeDataLink, document.querySelector("#vis3"));
          resolve();
        });
      }else{
        resolve();
      }
    });



    // start here !!
    C.all([vis1Loaded, vis2Loaded, vis3Loaded]).then(function () {
      gui.current.start(options.projectID);
    })



    // ==============
    // -- HELPERS ---
    // ==============

    function getJsonFromUrl() {
      var query = location.search.substr(1);
      var result = {};
      query.split("&").forEach(function(part) {
        var item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
      });
      return result;
    }



  });
});
