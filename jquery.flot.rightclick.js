/*
 * jquery.flot.rightclick
 * 
 * description: easy-to-use contextual menu for Flot charts
 * version: 0.1.2
 * authors: Francesco Nicastri
 * website: https://github.com/cicolabs/flot.rightclick
 * 
 * released under MIT License, 2017
 */

(function($) {
	// console.log("rc")
	// plugin options, default values
	var defaultOptions = {
		rightclick: {
			show: true,
			cssClass: "rightClickMenu",
			defaultTheme: true,
			snap: true,
			lines: false,
			clickTips: false,
			chartContextMenu: {},
			// callbacks
			// onHover: function(flotItem, $tooltipEl) {},
			// onClick: function(flotItem, $tooltipEl) { console.log("ckqwg") },
			// contextmenu: function(flotItem, $tooltipEl) { console.log(flotItem);console.log($tooltipEl) },
			$compat: false
		}
	};



	// object
	var RightClick = function(plot) {
		// variables
		this.tipPosition = { x: 0, y: 0 };

		this.init(plot);
	};


	// main plugin function
	RightClick.prototype.init = function(plot) {
		var that = this;
		var plotOffset = plot.getPlotOffset();

		var menuOpen;

		// detect other flot plugins
		var plotPluginsLength = $.plot.plugins.length;
		this.plotPlugins = [];

		if (plotPluginsLength) {
			for (var p = 0; p < plotPluginsLength; p++) {
				this.plotPlugins.push($.plot.plugins[p].name);
			}
		}

		plot.hooks.bindEvents.push(function(plot, eventHolder) {

			// get plot options
			that.plotOptions = plot.getOptions();

			// if not enabled return
			if (that.plotOptions.rightclick.show === false || typeof that.plotOptions.rightclick.show === 'undefined') return;

			// shortcut to access rightclick options
			that.rightclickOptions = that.plotOptions.rightclick;
			that.chartContextMenu = that.plotOptions.rightclick.chartContextMenu

			// bind event

			$(eventHolder).bind('contextmenu', contextmenu);
			// $(eventHolder).on('contextmenu', contextmenu);

			// $(document).bind("click", plotclick2);
			$("#context-menu").mouseleave(function(e) { $(this).hide(); })

			// $('.context-menu__link').on('click', viewData);

			$(plot.getPlaceholder()).bind("plotrightclick", rightclick);



			function contextmenu(e) {
				e.preventDefault();
				triggerContextMenuEvent("plotrightclick", e,
					function(s) {
						return s["clickable"] != false;
					});
			}

			function triggerContextMenuEvent(eventname, event, seriesFilter) {

				var offset = eventHolder.offset(),
					canvasX = event.pageX - offset.left - plotOffset.left,
					canvasY = event.pageY - offset.top - plotOffset.top,
					pos = plot.c2p({ left: canvasX, top: canvasY });

				pos.pageX = event.pageX;
				pos.pageY = event.pageY;

				var item = findNearbyItem(canvasX, canvasY, seriesFilter);

				if (item) {
					// fill in mouse pos for any listeners out there
					item.pageX = parseInt(item.series.xaxis.p2c(item.datapoint[0]) + offset.left + plotOffset.left, 10);
					item.pageY = parseInt(item.series.yaxis.p2c(item.datapoint[1]) + offset.top + plotOffset.top, 10);
				}

				$(plot.getPlaceholder()).trigger(eventname, [pos, item]);
			}


			// returns the data item the mouse is over, or null if none is found
			function findNearbyItem(mouseX, mouseY, seriesFilter) {
				var maxDistance = that.plotOptions.grid.mouseActiveRadius,
					smallestDistance = maxDistance * maxDistance + 1,
					item = null,
					foundPoint = false,
					i, j, ps;
				series = plot.getData();
				for (i = series.length - 1; i >= 0; --i) {
					if (!seriesFilter(series[i]))
						continue;

					var s = series[i],
						axisx = s.xaxis,
						axisy = s.yaxis,
						points = s.datapoints.points,
						mx = axisx.c2p(mouseX), // precompute some stuff to make the loop faster
						my = axisy.c2p(mouseY),
						maxx = maxDistance / axisx.scale,
						maxy = maxDistance / axisy.scale;

					ps = s.datapoints.pointsize;
					// with inverse transforms, we can't use the maxx/maxy
					// optimization, sadly
					if (axisx.options.inverseTransform)
						maxx = Number.MAX_VALUE;
					if (axisy.options.inverseTransform)
						maxy = Number.MAX_VALUE;

					if (s.lines.show || s.points.show) {
						for (j = 0; j < points.length; j += ps) {
							var x = points[j],
								y = points[j + 1];
							if (x == null)
								continue;

							// For points and lines, the cursor must be within a
							// certain distance to the data point
							if (x - mx > maxx || x - mx < -maxx ||
								y - my > maxy || y - my < -maxy)
								continue;

							// We have to calculate distances in pixels, not in
							// data units, because the scales of the axes may be different
							var dx = Math.abs(axisx.p2c(x) - mouseX),
								dy = Math.abs(axisy.p2c(y) - mouseY),
								dist = dx * dx + dy * dy; // we save the sqrt

							// use <= to ensure last point takes precedence
							// (last generally means on top of)
							if (dist < smallestDistance) {
								smallestDistance = dist;
								item = [i, j / ps];
							}
						}
					}

					if (s.bars.show && !item) { // no other point can be nearby

						var barLeft, barRight;

						switch (s.bars.align) {
							case "left":
								barLeft = 0;
								break;
							case "right":
								barLeft = -s.bars.barWidth;
								break;
							default:
								barLeft = -s.bars.barWidth / 2;
						}

						barRight = barLeft + s.bars.barWidth;

						for (j = 0; j < points.length; j += ps) {
							var x = points[j],
								y = points[j + 1],
								b = points[j + 2];
							if (x == null)
								continue;

							// for a bar graph, the cursor must be inside the bar
							if (series[i].bars.horizontal ?
								(mx <= Math.max(b, x) && mx >= Math.min(b, x) &&
									my >= y + barLeft && my <= y + barRight) :
								(mx >= x + barLeft && mx <= x + barRight &&
									my >= Math.min(b, y) && my <= Math.max(b, y)))
								item = [i, j / ps];
						}
					}
				}
				if (item) {
					i = item[0];
					j = item[1];
					ps = series[i].datapoints.pointsize;
					return {
						datapoint: series[i].datapoints.points.slice(j * ps, (j + 1) * ps),
						dataIndex: j,
						series: series[i],
						seriesIndex: i
					};
				}
				return null;
			} //bindevents


			initMenu(that.chartContextMenu)

		});
			function initMenu(menuItems) {


				list = $("<ul>", { class: "context-menu__items" });
				for (var i = menuItems.length - 1; i >= 0; i--) {
					menuItem = menuItems[i]
					if (typeof menuItem.callback == "string" ) {
						menuItem.callback = window[menuItem.callback]
					}
					list.append($('<li class="context-menu__item"><a href="#" class="context-menu__link">' + menuItem.label + '</a></li>').on("click",{item:"boom"},menuItem.callback));
				}
				$("#context-menu").append(list);
			}

		function plotclick2(event, pos, item) {
			// console.log(event)
			var bullet = $("#bullet");
			offset = $("#bullet").parent().offset();
			x = event.pageX - offset.left;
			y = event.pageY - offset.top;
			bullet.css({ top: y, left: x });
		}

		function rightclick(event, pos, item) {
			if (item) {
				var menu = $("#context-menu");
				var offset = $(menu).parent().offset();
				x = pos.pageX - offset.left - 10;
				y = pos.pageY - offset.top - 10;
				menu.data('item', item) //.datapoint[0]

				w = $(document).width();
				mw = menu.width();
				mow = menu.outerWidth();
				if ((w - (x+mow)) > 0) {
					menu.css({ top: y, left: x });
				} else {
					menu.css({ top: y, left: x - mw });
				}
				menu.show();
				menuOpen = true;
			}
		}
	};

	function closeMenu() {
		$("#context-menu").hide();
	}

	function viewData(e) {
		$('.context-menu').hide();
		e.preventDefault();

		date = new Date($(this).parent().parent().parent().data('item').datapoint[0]);

		d = date.getDate();
		d = d > 9 ? d : "0" + d;
		m = date.getMonth() + 1;
		m = m > 9 ? m : "0" + m;
		y = date.getFullYear();
		date = d + "/" + m + "/" + y;

		$('#daily_calendar-calendar-container').data("DateTimePicker").date(date)

	}

	function toggleMenu(item) {
		if (item) {
			var menu = $("#context-menu");
			var offset = $(menu).parent().offset();
			x = pos.pageX - offset.left;
			y = pos.pageY - offset.top;

			menu.css({ top: y, left: x });
			menu.show();
		}
	}


	var init = function(plot) {
		new RightClick(plot);
	};


	$.plot.plugins.push({
		init: init,
		options: defaultOptions,
		name: "rightclick",
		version: "0.1"
	});
})(jQuery);
