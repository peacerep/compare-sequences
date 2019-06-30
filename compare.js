"use strict";

////////////////////////////////////////////////////////////////////////////////
//////////////////////////// EVENT LISTENERS ///////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

d3.select("#selectAllCodes").on("click", function() {
	// check all checkboxes
	d3.selectAll("#codesCheckboxes input").property("checked", true);
	let event = new Event("change");
	eventHandler.dispatchEvent(event);
});

d3.select("#deselectAllCodes").on("click", function() {
	// uncheck all checkboxes
	d3.selectAll("#codesCheckboxes input").property("checked", false);
	let event = new Event("change");
	eventHandler.dispatchEvent(event);
});

// clicking anywhere in any of the svg's will reset the agreement details
var selectedAgtDetails = null;
d3.selectAll("svg").on("click", function() {
	selectedAgtDetails = null;
	agtDetails(null);
});

// initialise code checkboxes w/o coloured background
makeCodesCheckboxes(false);

// initialise infobox
agtDetails(null);

// expand Code Selection div
d3.select("#codeSelectionSection h3").on("click", function() {
	console.log("toggle", d3.select(this).classed("hidden"));
	d3.select("#codeSelectionSection .hideshow").classed(
		"hidden",
		!d3.select("#codeSelectionSection .hideshow").classed("hidden")
	);
});

// Legend
// abuse checkmark styles to create legend
var codesCheckboxes = d3
	.select("#legend")
	.selectAll("span")
	.data(stages)
	.enter()
	.append("span")
	.classed("cb-container", true);
codesCheckboxes.html(d => stagesLong[d] + "<br>");
var checkmark = codesCheckboxes
	.append("span")
	.classed("checkmark", true)
	.style("background-color", d => stageColour(d, true));

////////////////////////////////////////////////////////////////////////////////
////////////////////////// SET UP SVG //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var nTimelines = 3; // there are 3 timelines (they all need to be defined in html)

// define margin and dimensions of svg
var margin = { top: 25, right: 5, bottom: 5, left: 45 },
	height = 880 - margin.top - margin.bottom,
	width = 320 - margin.left - margin.right;

// define size and padding for agreement blocks
var agtPadding = 2,
	agtSpacing = 1,
	agtWidth = 5;
// agtHeight defined based on data

// create svg and g for each timeline
for (var i = 0; i < nTimelines; i++) {
	var svg = d3
		.select("#timeline-v" + i)
		.append("svg")
		.attr("height", height + margin.top + margin.bottom)
		.attr("width", width + margin.left + margin.right)
		.attr("id", "svg" + i)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
		.attr("id", "timeline-v" + i + "-g");
}

////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// PNG EXPORT /////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

d3.select("#timeline-v0-export").on("click", function() {
	saveSvgAsPng(document.getElementById("svg0"), "paxvis-image", {
		scale: 5,
		backgroundColor: "#fff"
	});
});
d3.select("#timeline-v1-export").on("click", function() {
	saveSvgAsPng(document.getElementById("svg1"), "paxvis-image", {
		scale: 5,
		backgroundColor: "#fff"
	});
});
d3.select("#timeline-v2-export").on("click", function() {
	saveSvgAsPng(document.getElementById("svg2"), "paxvis-image", {
		scale: 5,
		backgroundColor: "#fff"
	});
});

////////////////////////////////////////////////////////////////////////////////
//////////////////////////////// DATA //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

d3.csv("data/pa-x.csv", parseData)
	.then(function(data) {
		var years = getYears(data);

		var minDate = parseDate(years[0] - 1 + "-06-30"); //2011-12-05
		var maxDate = parseDate(years[1] + "-06-30");

		// create time scale and y axis
		var y = d3
			.scaleTime()
			.domain([minDate, maxDate]) // data space
			.range([margin.top, height - margin.bottom]); // display space

		var yAxis = d3
			.axisLeft(y)
			.tickFormat(d3.timeFormat("%Y"))
			.ticks(d3.timeYear.every(1))
			.tickPadding([5]);

		// draw axis into each timeline svg
		for (var i = 0; i < nTimelines; i++) {
			d3.select("#timeline-v" + i + "-g")
				.append("g")
				.attr("transform", "translate(-2, 0)")
				.attr("class", "yaxis")
				.call(yAxis);
		}

		populateDropdowns(nTimelines, data, y);

		d3.selectAll("#sidebar input, .input").on("change", function() {
			for (var i = 0; i < nTimelines; i++) {
				updateTimeline(i, data, y);
			}
		});
	})
	.catch(function(error) {
		throw error;
	});

////////////////////////////////////////////////////////////////////////////////
////////////////////////////// FUNCTIONS ///////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function populateDropdowns(nTimelines, data, yScale) {
	// extract all country/entity names from data and add to dropdowns
	var selectCountries = getConNames(data);

	for (var i = 0; i < nTimelines; i++) {
		// configure dropdowns to update timelines on change
		var dropdown = d3
			.select("#timeline-v" + i + "-select")
			.data(selectCountries)
			.on("change", function() {
				// update timeline
				// get index of current div
				var index = this.id.match(/\d/g)[0];
				updateTimeline(index, data, yScale);
			});

		// add all countries/entities to dropdown
		dropdown
			.selectAll("option .new")
			.data(selectCountries)
			.enter()
			.append("option")
			.text(function(d) {
				return d;
			})
			.attr("value", function(d) {
				return d;
			});
	}
}

function updateTimeline(index, data, yScale) {
	// get country
	var country = d3.select("#timeline-v" + index + "-select").property("value");

	// if no country is selected, don't do anything
	if (country == 0) {
		return;
	}

	// filter the data for the current country only
	var data_country = data.filter(function(d) {
		return d.con.indexOf(country) != -1;
	});

	// get filters from inputs on the left
	var filters = getSelectedCodes();

	// apply filters
	var data_country = data_country.filter(function(d) {
		return applyFilters(d, filters);
	});

	// Group agreements by Year (create an array of objects whose key is the
	// year and value is an array of objects (one per agreement))
	var years = d3
		.nest()
		.key(function(d) {
			return d.year;
		})
		.sortKeys(d3.ascending)
		.sortValues(function(a, b) {
			return d3.descending(a.date, b.date);
		})
		.entries(data_country);

	// get current g
	var g = d3.select("#timeline-v" + index + "-g");

	// remove previous rectangles (if any)
	g.selectAll("rect").remove();

	// calculate height of agreement rect
	var yr = getYears(data);
	var agtHeight = height / (1 + yr[1] - yr[0]) - agtPadding;
	// maybe implement later:

	// Find the maximum number of agreements in a single year for a single country/entity
	// var con_year_nest = d3.nest()
	// 	.key(function(d){ return d.Con; })
	// 	.key(function(d){ return d.Year; })
	// 	.rollup(function(leaves){ return leaves.length; })
	// 	.entries(data);
	// var maxAgts = 1;
	// for (c = 0; c < con_year_nest.length; c++){
	// 	var sub = con_year_nest[c].values;
	// 	// console.log(sub);
	// 	var agts = d3.max(sub, function(d){ return d.value; });
	// 	if (agts > maxAgts){
	// 		maxAgts = agts;
	// 	}
	// }
	// Set the agreement width (pixels) based on the maximum possible agts to display in a year
	// var agtWidth = (width-yWidth)/(maxAgts);

	for (var i = 0; i < years.length; i++) {
		var rects = g
			.selectAll("rect .y" + i)
			.data(years[i].values)
			.enter()
			.append("rect")
			.classed("y" + i, true)
			.attr("fill", d => stageColour(d)) // see functions.js
			.attr("x", function(d, i) {
				return (agtWidth + agtSpacing) * i;
			})
			.attr("y", function(d) {
				return yScale(parseYear(d.year)) - agtHeight / 2;
			})
			.attr("width", agtWidth)
			.attr("height", agtHeight);

		rects.on("click", function(d) {
			// display infobox permanently (until click somewhere else in svg??)
			if (selectedAgtDetails == d) {
				selectedAgtDetails = null;
			} else {
				selectedAgtDetails = d;
			}
			agtDetails(d);
			event.stopPropagation();
		});

		rects.on("mouseover", function(d) {
			// display infobox
			agtDetails(d);
		});
		rects.on("mouseout", function(d) {
			// remove infobox
			agtDetails(selectedAgtDetails);
		});
	} // end for loop (years)

	// chart header (country/entity name)
	g.selectAll(".svg-header").remove();
	g.append("text")
		.classed("svg-header", true)
		.attr("x", "5px")
		.attr("y", margin.top - 15)
		.attr("font-weight", "bold")
		.text(country);
} // end updateTimeline function

function applyFilters(dat, filters) {
	// if filters empty, everything passes the test
	if (filters.codes.length == 0) {
		return true;
	}
	// otherwise we actually need to check
	else {
		// get an array of true/false for all filters
		var tf = [];
		for (var i = 0; i < filters.codes.length; i++) {
			tf.push(dat[filters.codes[i]] > 0);
		}
		// for the ANY rule, it is enough if there is at least one true
		if (filters.any) {
			return tf.some(function(d) {
				return d;
			});
		}
		// for the ALL rule, everything in the array has to be true
		else {
			return tf.every(function(d) {
				return d;
			});
		}
	}
}
