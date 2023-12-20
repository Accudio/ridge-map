import os from 'os';
import path from 'path';
import hgt from "node-hgt";
import paper from "paper-jsdom";
import { optimize } from "svgo";
import { writeFile, mkdir } from 'fs/promises';
import proj4 from "proj4";

class RidgeMap {
	/**
	 * Creates an instance of RidgeMap.
	 *
	 * @constructor
	 * @public
	 * @param {object} param0
	 * @param {[number, number, number, number]} param0.bbox - The longitude/latitude bounding box of the desired region. See http://bboxfinder.com
	 * @param {string} [param0.projection=lnglat] - The map projection to use. Accepted values are 'lnglat' (default), 'equirectangular' (same as 'lnglat'), 'web-mercator', 'mercator' or any valid PROJ4 string for a cylindrical projection.
	 * @param {string('south','west','north','east')} [param0.viewpoint=south] - The cardinal direction the ridgemap is viewed from.
	 */
	constructor({ bbox, projection, viewpoint }) {
		// destructure lng/lat from bbox, defaulting to Ben Nevis, Scotland
		const [ lng1, lat1, lng2, lat2 ] = bbox || [ -5.091141, 56.756959, -4.914158, 56.833387 ];

		// convert first position to chosen projection
		this.pos1 = this.#convertProjection(
			'lnglat',
			projection,
			[ lng1, lat1 ]
		);
		// convert second position to chosen projection
		this.pos2 = this.#convertProjection(
			'lnglat',
			projection,
			[ lng2, lat2 ]
		);

		// assign constants with defaults
		this.projection = projection || 'lnglat';
		this.viewpoint = viewpoint || 'south';
	}

	/**
	 * Get the elevation data for the bounding box from cached or online .hgt files
	 *
	 * @async
	 * @public
	 * @param {object} [param0={}]
	 * @param {number} [param0.num=80] - The number of lines to show vertically. Default 80
	 * @param {number} [param0.points=300] - The number of data points per line. Default 300
	 * @param {string} [cache] - Cache location for hgt files. Defaults to ~/.cache/srtm/
	 */
	async getElevationData({
		num = 80,
		points = 300,
		cache = undefined,
	} = {}) {
		// if east or west swap the num and the points around to get the right number of lines
		if (this.viewpoint === 'east' || this.viewpoint === 'west') {
			// eslint-disable-next-line no-self-assign
			num, points = points, num;
		}

		// if a cache hasn't been defined, default to ~/.cache/srtm/
		// this matches location of ridge-map.py library
		if (!cache) {
			cache = path.join(os.homedir(), '.cache/srtm/');
		}

		// create cache directory if it doesn't exist
		const cachePath = path.resolve(cache);
		await mkdir(cachePath, { recursive: true });

		// format is array of lines, going south to north
		// each line is an array of the elevation at each point
		let data = await this.#getData(num, points, cachePath);

		// if the viewpoint isn't south rotate the matrix to match with the viewpoint
		const numRotations = {
			'south': 0,
			'west': 3,
			'north': 2,
			'east': 1,
		};
		data = this.#rotate(data, numRotations[this.viewpoint]);

		this._data = data;
	}

	/**
	 * Generate ridge lines within paper.js
	 *
	 * @async
	 * @public
	 * @param {object} [param0={}]
	 * @param {number} [param0.lakeFlatness=0] - Remove flat segments from lines, useful for elevated lakes and rivers. Will remove any segments where the elevation changes by the provided number of meters across 3 elevation points. Set to 0 to disable, default 0
	 * @param {number} [param0.verticalRatio=40] - Scales elevation changes vertically to exaggerate them. Higher numbers will result in more vertical difference. Default 40
	 * @param {number} [param0.waterNTile=0] - Remove the bottom n meters, useful for sea, lakes and rivers. Set to 0 to disable, default 0
	 * @param {string} [param0.lineColor=black] - Color of lines, supporting any valid CSS Color format. Default black
	 * @param {number} [param0.lineWidth=0.1] - Width of lines, as used on an SVG canvas with width 100. Default 0.1
	 */
	async generate({
		lakeFlatness = 0,
		verticalRatio = 40,
		waterNTile = 0,
		lineColor = 'black',
		lineWidth = 0.1,
		backgroundColor = '#fff',
	} = {}) {
		// get correct aspect ratio and height of the output image
		const ratio = (this.pos2[0] - this.pos1[0]) / (this.pos2[1] - this.pos1[1]);
		const width = 100;
		const height = width / ratio;

		// preprocess values
		const {
			values,
			oneMeter,
		} = this.#preprocess(verticalRatio);

		// setup paper.js
		paper.setup(new paper.Size(width, height));

		// turn line segments into polygons within paper.js
		const layerSrc = new paper.Layer();
		for (const line of values) {
			const lineSegments = line.map(({ x, y }) => [
				x * width / 100,
				y * height / 100,
			]);
			new paper.Path({
				segments: [
					...lineSegments,
					[ width, height ],
					[ 0, height ],
					lineSegments[0],
				],
			});
		}

		// loop through each layer and subtract all layers in front of this one. This will leave only the portions of the layer that are exposed and remove any hidden areas
		const srcPaths = layerSrc.getItems();
		const layerClip = new paper.Layer();
		for (let i = 0; i < srcPaths.length; i++) {
			let crop = srcPaths[i];
			for (let j = i + 1; j < srcPaths.length; j++) {
				crop = crop.subtract(srcPaths[j], { insert: false });
			}

			// if waterNTile is enabled, subtract the bottom n meters of this path
			if (waterNTile > 0) {
				const waterYPos = (values[i][0].baseY - (oneMeter * waterNTile)) * height / 100;
				let waterPath = new paper.Path({
					insert: false,
					segments: [
						[ 0, waterYPos ],
						[ width, waterYPos ],
						[ width, height ],
						[ 0, height ],
					],
				});
				crop = crop.subtract(waterPath, { insert: false });
			}

			layerClip.addChild(crop);
		}
		layerSrc.removeChildren();

		// if lakeFlatness is enabled, measure the difference and cut out parts of the line below the threshold
		let layerLakeFlatness = false;
		if (lakeFlatness > 0) {
			layerLakeFlatness = new paper.Layer();
			const cropLayers = layerClip.getItems();
			for (const layer of cropLayers) {
				let segments = [];
				// get the top line of each polygon. CompoundPaths may have multiple distinct polygons so treat them separately
				if (layer.className === 'CompoundPath') {
					for (const path of layer._children) {
						segments = [ ...segments, ...this.#paperGetStroke(path) ];
					}
				} else {
					segments = this.#paperGetStroke(layer);
				}
				if (!segments.length) continue;

				// measure difference for every node
				const segmentDiff = this.#lineDiff(segments)
					.map(el => ({
						...el,
						remove: el.diff < lakeFlatness * oneMeter,
					}));

				// go through all nodes and record where we should start and finish removing nodes. We do this to reduce the number of subtraction operations to a minimum.
				let removals = [];
				if (segmentDiff[0].remove) {
					removals.push(segmentDiff[0]);
				}
				for (let i = 0; i < segmentDiff.length - 1; i++) {
					const curr = segmentDiff[i];
					const next = segmentDiff[i+1];
					if (!curr.remove && next.remove) {
						// start
						removals.push(curr);
					}
					if (curr.remove && !next.remove) {
						removals.push(next);
					}
				}

				// if the length of removals isn't even, add the last node as the end of a removal
				if (removals.length % 2) {
					removals.push(segmentDiff.at(-1));
				}

				// for each removal, create a full-height polygon in the place that should be removed
				// then subtract it from this layer
				let crop = layer;
				for (let j = 0; j < removals.length; j += 2) {
					const start = removals[j];
					const end = removals[j+1];
					const slice = new paper.Path({
						insert: false,
						segments: [
							[ start.x, 0 ],
							[ end.x, 0 ],
							[ end.x, height ],
							[ start.x, height ],
						],
					});
					crop = crop.subtract(slice, { insert: false });
				}

				layerLakeFlatness.addChild(crop);
			}
			layerClip.removeChildren();
		}

		// the previous layer we operate on will depend on if we did lakeFlatness operation
		const thisLayer = layerLakeFlatness ? layerLakeFlatness : layerClip;
		const layers = thisLayer.getItems();
		new paper.Layer();

		// add background
		if (backgroundColor) {
			new paper.Path({
				segments: [
					[ 0, 0 ],
					[ width, 0 ],
					[ width, height ],
					[ 0, height ],
				],
				fillColor: backgroundColor,
			});
		}

		// change layers to instead be lines.
		for (const layer of layers) {
			// abstracted into a local arrow function to avoid repeating for CompoundPath
			const createPath = path => {
				// get the top line of this path and create a new path with that stroke
				const segments = this.#paperGetStroke(path);
				if (!segments.length) return;
				new paper.Path({
					segments,
					strokeColor: lineColor,
					strokeWidth: lineWidth,
				});
			};
			// for CompoundPaths process each distinct polygon as a separate line
			if (layer.className === 'CompoundPath') {
				for (const path of layer._children) {
					createPath(path);
				}
			} else {
				createPath(layer);
			}
		}

		thisLayer.removeChildren();

		this._paper = paper;
	}

	/**
	 * Generate SVG of ridge map, saving to the current directory
	 *
	 * @async
	 * @public
	 * @param {object} [param0={}]
	 * @param {string} [param0.name='ridge-map.svg'] - Filename to output to. Default ridge-map.svg
	 * @param {boolean} [param0.svgo=true] - Whether to optimise and compress the output with SVGO. Default true
	 */
	async save({
		name = 'ridge-map.svg',
		svgo = true,
	} = {}) {
		// output the SVG from paper as a string
		let svg = this._paper.project.exportSVG({ asString: true });

		// optimise the svg using SVGO if required. For a good result with paper.js output I've found enabling removeDimensions and disabling mergePaths and removeViewbox works best.
		if (svgo) {
			svg = optimize(svg, {
				plugins: [
					"removeDimensions",
					{
						name: 'preset-default',
						params: {
							overrides: {
								mergePaths: false,
								removeViewBox: false,
							},
						},
					},
				],
			}).data;
		}

		// write SVG content to the filesystem
		await writeFile(name, svg);
	}

	/**
	 * Gets elevation data from hgt and outputs in array format
	 *
	 * @async
	 * @private
	 * @param {number} num - The number of lines to show vertically
	 * @param {number} points - The number of data points per line
	 * @param {string} cache - Path to hgt cache directory
	 * @returns {Promise<Array.<number[]>>} - Two-dimensional array of lines and elevation points
	 */
	async #getData(num, points, cache) {
		// use hgt with defined tileset
		const tileset = new hgt.TileSet(cache);

		const xStep = (this.pos2[0] - this.pos1[0]) / points;
		const yStep = (this.pos2[1] - this.pos1[1]) / num;

		let rowPromises = [];
		for (let i = 0; i < num; i++) {
			rowPromises.push(new Promise(resolve => {
				const y = this.pos1[1] + (i * yStep);

				let colPromises = [];
				for (let j = 0; j < points; j++) {
					colPromises.push(new Promise(resolve => {
						const x = this.pos1[0] + (j * xStep);

						const point = this.#convertProjection(
							this.projection,
							'lnglat',
							[ x, y ]
						);

						tileset.getElevation(
							// everywhere else uses lng,lat but this uses lat,lng so swap the points
							[ point[1], point[0] ],
							(err, elevation) => {
								// if there's an error we assume the srtm data isn't available and therefore is 0 height
								resolve(err ? 0 : elevation);
							}
						);
					}));
				}

				Promise.all(colPromises).then(colResults => resolve(colResults));
			}));
		}

		const data = await Promise.all(rowPromises);

		return data;
	}

	/**
	 * Rotates a two dimensional array
	 *
	 * @private
	 * @param {Array.<any[]>} matrix - 2-dimensional array of values
	 * @param {number} [num=1] - Number of clockwise rotations. Default 1
	 * @returns {Array.<any[]>} - rotated array
	 */
	#rotate(matrix, num = 1) {
		for (let i = 0; i < num; i++) {
			matrix = matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
		}
		return matrix;
	}

	/**
	 * Converts co-ordinates from one projection system to another
	 *
	 * @private
	 * @param {string} from - Projection system of provided co-ordinates. Accepted values are 'lnglat' (default), 'equirectangular' (same as 'lnglat'), 'web-mercator', 'mercator' or any valid PROJ4 string for a cylindrical projection.
	 * @param {string} to - Projection system of output co-ordinates. Accepted values are 'lnglat' (default), 'equirectangular' (same as 'lnglat'), 'web-mercator', 'mercator' or any valid PROJ4 string for a cylindrical projection.
	 * @param {[number, number]} coord - Coordinates for conversion
	 * @returns {[number, number]} - converted coordinates
	 */
	#convertProjection(from, to, coord) {
		if (from === to) return coord;
		const projections = {
			'lnglat': 'EPSG:4326',
			'equirectangular': 'EPSG:4326',
			'web-mercator': 'EPSG:3857',
			// taken from somewhere online with lots of trial and error as proj4 seems quite picky on proj4 string formats
			'mercator': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
		};
		return proj4(
			projections[from] || from,
			projections[to] || to,
			coord
		);
	}

	/**
	 * Preprocesses elevation data into 0-100 range useful for plotting
	 *
	 * @private
	 * @param {number} verticalRatio - Scales elevation changes vertically to exaggerate them. Higher numbers will result in more vertical difference.
	 * @returns {PreprocessReturn}
	 */
	#preprocess(verticalRatio) {
		let values = this._data;

		// get min and max elevation
		let min = values[0][0];
		let max = values[0][0];
		for (const value of values.flat()) {
			if (value < min) min = value;
			if (value > max) max = value;
		}

		// remap elevation onto 0-verticalRatio
		let oneMeter = 1 / (max - min) * verticalRatio;
		values = values.map(row => row.map(col => {
			return (col - min) / (max - min) * verticalRatio;
		}));

		// calculate number of lines
		const numLines = values.length;
		const numPoints = values[0].length;
		const xInterval = 100 / (numPoints - 1);
		const yInterval = 100 / (numLines - 1);
		const scale  = 20 / numLines;
		oneMeter = oneMeter * scale;

		// change elevation point structure into object
		for (let i = 0; i < values.length; i++) {
			const yPos = i * yInterval;
			for (let j = 0; j < values[i].length; j++) {
				const height = values[i][j] * scale;
				/**
				 * @typedef {Object} PreprocessPoint
				 * @property {number} x - x position in range 0-100
				 * @property {number} y - y position in range 0-100
				 * @property {number} baseY - what y position 0m would be for this line
				 */
				values[i][j] = {
					x: xInterval * j,
					y: yPos + height,
					baseY: yPos,
				};
			}
		}

		// move points to all be positioned within the canvas
		const allYs = values.flat().map(val => val.y);
		const minY = Math.min(...allYs);
		const maxY = Math.max(...allYs);
		oneMeter = oneMeter * 100 / (maxY - minY);
		const remap = pos => {
			return 100 * (pos - minY) / (maxY - minY);
		};
		for (const line of values) {
			for (const point of line) {
				point.y = remap(point.y);
				point.baseY = remap(point.baseY);
			}
		}

		// flip y value to be top-down for SVG
		for (const line of values) {
			for (const point of line) {
				point.y = 100 - point.y;
				point.baseY = 100 - point.baseY;
			}
		}

		/**
		 * @typedef {Object} PreprocessReturn
		 * @property {number} oneMeter - the y value for one meter in the 0-100 range
		 * @property {Array.<PreprocessPoint[]>} values - array of lines with processed points
		 */
		return {
			oneMeter,
			values: values.reverse(),
		};
	}

	/**
	 * Takes a paper.js polygon and generate the points for a line that follows the top surface
	 *
	 * @private
	 * @param {*} path - paper.js path
	 * @returns {{ x: number, y: number }[]} - x and y coordinates for the top line of the path
	 */
	#paperGetStroke(path) {
		if (!path.segments.length) return [];

		let minX = path.segments[0];
		let maxX = path.segments[0];
		for (const point of path.segments.slice(1)) {
			// rounding to 2 decimal places otherwise a min/max lower down the page can sneak out with just a rounding difference
			const currXRound = this.#round(point._point._x);
			const currYRound = this.#round(point._point._y);
			const minXRound = this.#round(minX._point._x);
			const minYRound = this.#round(minX._point._y);
			const maxXRound = this.#round(maxX._point._x);
			const maxYRound = this.#round(maxX._point._y);

			// work out if this point is more top-left than previous ones
			if (
				currXRound < minXRound || (
					currXRound === minXRound &&
					currYRound < minYRound
				)
			) {
				minX = point;
			}
			// work out if this point is more top-right than previous ones
			if (
				currXRound > maxXRound || (
					currXRound === maxXRound &&
					currYRound < maxYRound
				)
			) {
				maxX = point;
			}
		}

		// takes the list of points and the index of min and max points to get an array of points that goes from min to max across the top.
		// this is fairly complex as a path could be either clockwise or anti-clockwise, and potentially start between the min and max. Therefore we need to stitch the array around the seam
		let points;
		if (path.clockwise) {
			if (minX._index < maxX._index) {
				points = path.segments.slice(minX._index, maxX._index + 1);
			} else {
				let maxPoints = path.segments.slice(0, maxX._index + 1);
				let minPoints = path.segments.slice(minX._index);
				points = [ ...minPoints, ...maxPoints ];
			}
		} else {
			if (minX._index > maxX._index) {
				points = path.segments.slice(maxX._index, minX._index + 1);
			} else {
				let minPoints = path.segments.slice(0, minX._index + 1);
				let maxPoints = path.segments.slice(maxX._index);
				points = [ ...maxPoints, ...minPoints ];
			}
			points = points.reverse();
		}

		return points.map(point => ({
			x: point._point._x,
			y: point._point._y,
		}));
	}

	/**
	 * Gets the total difference in y position between the current, previous and next points
	 *
	 * @private
	 * @param {{ x: number, y: number }[]} segments - array of points for the line
	 * @returns {{ x: number, y: number, diff: number }[]} - same array of points with the addition of diff
	 */
	#lineDiff(segments) {
		for (let i = 0; i < segments.length; i++) {
			let totalDiff = 0;
			if (i > 0) {
				totalDiff += Math.abs(segments[i].y - segments[i - 1].y);
			} else if (i < segments.length - 1) {
				totalDiff += Math.abs(segments[i].y - segments[i + 1].y);
			}
			segments[i].diff = totalDiff;
		}
		return segments;
	}

	/**
	 * Rounds number to the provided number of decimal places
	 *
	 * @private
	 * @param {number} num
	 * @param {number} [digits=2]
	 * @returns {number}
	 */
	#round(num, digits = 2) {
		return Math.round(num * 10**digits) / 10**digits;
	}
}

export default RidgeMap;