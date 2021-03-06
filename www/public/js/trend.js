var trend = (function() {

    var twoppDataFromDb;
    var primaryDataFromDb;
    var pollDataFromDb;

    var colourPalette = {
        "ALP": "#ec2929",
        "ALP2pp": "#ec2929",
        "LNP": "#0037ff",
        "LNP2pp": "#0037ff",
        "GRN": "#36ce32",
        "PUP": "#bb00ff",
        "OTH": "#d1e349"
    };

    var knownPollsters = ["Galaxy", "Ipsos", "Morgan", "EssentialOnline", "Newspoll",
        "Nielsen", "MorganSMS", "ReachTEL", "MorganMulti", "Essential",
        "Election", "NewspollQuarterly"
    ];

    var graphLabels = ["time", "ALP"];
    var graphColours = [colourPalette.ALP];
    var graphSeriesOptions = {};
    var graph;


    var graphState = {
        electorate: "AUS",
        partypov: "BOTH",
        yaxis: "auto",
        type: "twopp",
        primariesToShow: ["ALP", "LNP", "GRN", "PUP", "OTH"],
        showPollsters: true
    };


    function drawGraph() {
        var plotData = gatherData();
        var columnNames = ["time"].concat(plotData.colnames);
        var graphOptions = prepareDygraphsOptionsObject(plotData, columnNames);
        if (graph === undefined) {
            // Set an initial datewindow that will be overridden by the user
            graphOptions.dateWindow = [new Date("2014-01-01"), new Date("2016-07-15")];
            delete graphOptions.file; // because we specify graphData explicitly
            graphOptions.width = Math.min(650, 0.9*document.getElementById('container').offsetWidth);
            graphOptions.height = 0.9*graphOptions.graphWidth;
            graphOptions.axes = { 'y': {'valueFormatter': function(ppt){return(ppt.toFixed(1));}} };
            graph = new Dygraph(
                document.getElementById("trend-chart"),
                plotData.data, graphOptions);
        } else {
            graph.updateOptions(graphOptions);
        }
    }

    function gatherData() {
        var trendData;
        var pollsterFilterFunction;
        if (graphState.type === "twopp") {
            if (graphState.partypov === "ALP") {
                pollsterFilterFunction = function(pname) {
                    return (pname.split(' ')[1] === "ALP2pp");
                };
                trendData = twoppDataFromDb.column("ALP");
            } else if (graphState.partypov === "LNP") {
                pollsterFilterFunction = function(pname) {
                    return (pname.split(' ')[1] === "LNP2pp");
                };
                trendData = twoppDataFromDb.column("LNP");
            } else {
                pollsterFilterFunction = function(pname) {
                    return ((pname.split(' ')[1] === "ALP2pp") || (pname.split(' ')[1] === "LNP2pp"));
                };
                trendData = twoppDataFromDb.columns(["ALP", "LNP"]);
            }
        } else {
            pollsterFilterFunction = function(pname) {
                return (graphState.primariesToShow.indexOf(pname.split(' ')[1]) !== -1);
            };
            trendData = primaryDataFromDb.columns(graphState.primariesToShow);
        }
        var displayPollsters = graphState.showPollsters;
        var pollsterData;
        if (graphState.showPollsters) {
            var availablePollsterRows = Object.keys(pollDataFromDb).filter(pollsterFilterFunction);
            if (availablePollsterRows.length === 0) {
                displayPollsters = false;
            } else {
                pollsterData = availablePollsterRows
                    .map(function(pname) {
                        return pollDataFromDb[pname];
                    })
                    .reduce(function(prevPolls, thisPoll) {
                        return prevPolls.merge(thisPoll);
                    });
            }
        }
        if (displayPollsters) {
            return trendData.merge(pollsterData);
        } else {
            return trendData;
        }
    }

    function prepareDygraphsOptionsObject(dataFrame, columnNames) {
        var containerDivWidth = $("#trend").width();
        var titleHeightPx = containerDivWidth > 500 ? 30 : 20;
        return {
            file: dataFrame.data,
            labels: columnNames,
            errorBars: true,
            title: getTitle(),
            ylabel: '(per cent)',
            legend: 'hideOverlayOnMouseOut',
            labelsDivStyles: {
                'textAlign': 'right'
            },
            showRangeSelector: true,
            colors: getGraphColours(columnNames.slice(1)),
            series: getGraphSeriesOptions(),
            width: 0.8 * containerDivWidth,
            height: 0.6 * containerDivWidth,
            titleHeight: titleHeightPx
        };
    }

    function getTitle() {
        var electorateName = graphState.electorate;
        if (graphState.electorate === "AUS") {
            electorateName = "All of Australia";
        }
        var partyNameString = graphState.partypov;
        if(graphState.type === "primary"){
            partyNameString = graphState.primariesToShow.join(', ');
        }else if (graphState.partypov === "BOTH") {
            partyNameString = "LNP/ALP";
        }
        var graphTypeString = "";
        if (graphState.type === "twopp") {
            graphTypeString = "share of two-party preferred";
        } else {
            graphTypeString = "primary vote shares";
        }
        return partyNameString + " \u2013 " + graphTypeString + " \u2013 " + electorateName;
    }

    function getGraphColours(colNames) {
        return colNames.map(function(c) {
            var partyCol = colourPalette[c];
            if (partyCol === undefined) {
                if (graphState.type === "twopp" && (graphState.partypov === "ALP" || graphState.partypov === "LNP")) {
                    return "#515151";
                }
                var partyName = c.split(" ")[1];
                if (partyName === undefined) {
                    return "black";
                }
                partyCol = colourPalette[partyName];
                if (partyCol === undefined) {
                    return "black";
                }
                return partyCol;
            } else {
                return partyCol;
            }
        });
    }

    function partyToShowInRangeSelector() {
        if (graphState.type === "twopp") {
            if (graphState.partypov === "ALP") {
                return "ALP";
            } else {
                return "LNP";
            }
        } else {
            return graphState.primariesToShow[0];
        }
    }

    function getGraphSeriesOptions() {
        var output = {};
        var knownParties = ["ALP", "ALP2pp", "LNP", "LNP2pp", "GRN", "PUP", "OTH"];
        knownParties.forEach(function(p) {
            output[p] = {
                "connectSeparatedPoints": true,
                "strokeWidth": 2
            };
            if (p === partyToShowInRangeSelector()) {
                output[p].showInRangeSelector = true;
            }
        });
        knownPollsters.forEach(function(pollster) {
            knownParties.forEach(function(party) {
                output[pollster + " " + party] = {
                    "strokeWidth": 0,
                    "pointSize": 2
                };
            });
        });
        return output;
    }

    function getDataForElectorate(electorate, callback) {
        if (graphState.type === "twopp") {
            getPrimaryDataForElectorate(electorate, function() {});
            getTwoppDataForElectorate(electorate,
                function() {
                    getPollDataForElectorate(electorate, callback);
                }
            );
        } else {
            getTwoppDataForElectorate(electorate, function() {});
            getPrimaryDataForElectorate(electorate,
                function() {
                    getPollDataForElectorate(electorate, callback);
                }
            );
        }
    }

    function getPollDataForElectorate(electorate, callback) {
        $.ajax({
            url: "http://" + document.location.host + "/polls?electorate=" + electorate,
            error: function(jqXHR, textStatus, errorThrown) {
                console.log(errorThrown);
            },
            success: function(data) {
                if (data.length < 2) {
                    return;
                }
                pollDataFromDb = {};
                data.forEach(function(v) {
                    var pollsterName = v[1];
                    var partyName = v[4];
                    var pollsterPartyName = pollsterName + " " + partyName;
                    if (pollDataFromDb[pollsterPartyName] === undefined) {
                        pollDataFromDb[pollsterPartyName] = new DatedDataFrame([], pollsterPartyName);
                    }
                    pollDataFromDb[pollsterPartyName].push([new Date(v[0]), [v[2], null]]);
                    if (partyName === "ALP2pp") {
                        var pollsterLNPname = pollsterName + " LNP2pp";
                        if (pollDataFromDb[pollsterLNPname] === undefined) {
                            pollDataFromDb[pollsterLNPname] = new DatedDataFrame([], pollsterLNPname);
                        }
                        pollDataFromDb[pollsterLNPname].push([new Date(v[0]), [100 - v[2], null]]);
                    }
                });
                callback();
            }
        });
    }

    function getTwoppDataForElectorate(electorate, callback) {
        $.ajax({
            url: "http://" + document.location.host + "/twopp?electorate=" + electorate,
            error: function(jqXHR, textStatus, errorThrown) {
                console.log(errorThrown);
            },
            success: function(d) {
                var data = d.map(function(v) {
                    return [new Date(v[0]), v[1],
                        [100 - v[1][0], v[1][1]]
                    ];
                });
                colnames = ["ALP", "LNP"];
                twoppDataFromDb = new DatedDataFrame(data, colnames);
                callback();
            }
        });
    }

    function getPrimaryDataForElectorate(electorate, callback) {
        $.ajax({
            url: "http://" + document.location.host + "/primary?electorate=" + electorate,
            error: function(jqXHR, textStatus, errorThrown) {
                console.log(errorThrown);
            },
            success: function(d) {
                var data = {
                    "ALP": [],
                    "LNP": [],
                    "GRN": [],
                    "PUP": [],
                    "OTH": []
                };
                d.forEach(function(row) {
                    data[row[1]].push([new Date(row[0]), row[2]]);
                });
                primaryDataFromDb = new DatedDataFrame(data.ALP, "ALP")
                    .merge(new DatedDataFrame(data.LNP, "LNP"))
                    .merge(new DatedDataFrame(data.GRN, "GRN"))
                    .merge(new DatedDataFrame(data.PUP, "PUP"))
                    .merge(new DatedDataFrame(data.OTH, "OTH"));
                callback();
            }
        });
    }

    function changeGraphToElectorate(electorate) {
        getDataForElectorate(electorate, drawGraph);
    }

    function changeGraphState(key, value) {
        graphState[key] = value;
        // TODO: save cookie
    }

    $("#trend-electorate-select").change(function() {
        changeGraphState("electorate", $(this).val());
        changeGraphToElectorate($(this).val());
    });

    $("#trend-yaxis-range").change(function() {
        if ($(this).val() === "auto") {
            graph.updateOptions({
                valueRange: [null, null]
            });
        } else if ($(this).val() === "fixed") {
            if (graphState.type === "twopp") {
                graph.updateOptions({
                    valueRange: [35, 65]
                });
            } else {
                graph.updateOptions({
                    valueRange: [0, 50]
                });
            }
        }
        changeGraphState("yaxis", $(this).val());
    });

    $("#twopp-party").change(function() {
        changeGraphState("partypov", $(this).val());
        drawGraph();
    });

    $("#trend-graph-type").change(function() {
        changeGraphState("type", $(this).val());
        if ($(this).val() === "twopp") {
            $("#twopp-party").prop('disabled', false);
        } else {
            $("#twopp-party").prop('disabled', true);
        }
        drawGraph();
    });

    $("#show-pollsters").change(function() {
        changeGraphState("showPollsters", $(this).val() === "show" ? true : false);
        drawGraph();
    });

    $("#show-ALP").change(function() {
        var currentList = graphState.primariesToShow;
        if ($(this).prop("checked")) {
            changeGraphState("primariesToShow", currentList.concat("ALP"));
        } else {
            currentList.splice(currentList.indexOf("ALP"), 1);
            changeGraphState("primariesToShow", currentList);
        }
        drawGraph();
    });
    $("#show-LNP").change(function() {
        var currentList = graphState.primariesToShow;
        if ($(this).prop("checked")) {
            changeGraphState("primariesToShow", currentList.concat("LNP"));
        } else {
            currentList.splice(currentList.indexOf("LNP"), 1);
            changeGraphState("primariesToShow", currentList);
        }
        drawGraph();
    });
    $("#show-GRN").change(function() {
        var currentList = graphState.primariesToShow;
        if ($(this).prop("checked")) {
            changeGraphState("primariesToShow", currentList.concat("GRN"));
        } else {
            currentList.splice(currentList.indexOf("GRN"), 1);
            changeGraphState("primariesToShow", currentList);
        }
        drawGraph();
    });
    $("#show-PUP").change(function() {
        var currentList = graphState.primariesToShow;
        if ($(this).prop("checked")) {
            changeGraphState("primariesToShow", currentList.concat("PUP"));
        } else {
            currentList.splice(currentList.indexOf("PUP"), 1);
            changeGraphState("primariesToShow", currentList);
        }
        drawGraph();
    });
    $("#show-OTH").change(function() {
        var currentList = graphState.primariesToShow;
        if ($(this).prop("checked")) {
            changeGraphState("primariesToShow", currentList.concat("OTH"));
        } else {
            currentList.splice(currentList.indexOf("OTH"), 1);
            changeGraphState("primariesToShow", currentList);
        }
        drawGraph();
    });
    $(document).ready(function() {
        // TODO: read cookie
        getDataForElectorate('AUS', drawGraph);

        $(window).resize(function() {
            drawGraph();
        });
        window.addEventListener("orientationchange", function() {
            drawGraph();
        });
    });

})();
