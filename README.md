# Ridge Map

Ridge map uses elevation data to make SVG plots of ridges. Provided with location co-ordinates and some configuration detail you can create a beautiful visualisation of elevation data.

Inspired by and borrows a lot of methods from [ColCarroll's ridge_map Python library](https://github.com/ColCarroll/ridge_map/), but written from scratch for node.js with additional functionality and priorities not available in `ridge_map`:

- Removed text label - you can add that yourself with more control in a design program.
- Uses true strokes instead of polygons with a solid background. This makes it more flexible for use elsewhere.
- Uses direct SVG manipulation instead of a plotting library for better SVG output.
- Supports multiple map projections including mercator, web mercator, and any Proj4 valid cylindrical projections.
- Doesn't support colormaps or elevation gradients.

<img src="https://github.com/accudio/ridge-map/raw/main/.assets/everest.png" width="1000" height="380" loading="eager" alt="Ridge map of the Himalayas, centred around Mt Everest">

## Installation

Create a fresh npm directory and install with [NPM](https://www.npmjs.com/package/ridge-map):

```sh
npm install ridge-map
```

Alternatively install the live development build with git:

```sh
npm install git+https://github.com/accudio/ridge-map.git
```

## Usage

For basic usage, import and create a new RidgeMap with your bounding box and run getElevationData, generate and save:

```js
import RidgeMap from 'ridge-map'

const map = new RidgeMap({
	// include your bounding box from http://bboxfinder.com
	bbox: [-3.886049,57.006752,-3.673875,57.184492],
})
await map.getElevationData()
await map.generate()
await map.save()
```

For advanced usage you can provide additional options:

```js
import RidgeMap from './src/index.js'

const map = new RidgeMap({
	// include your bounding box from http://bboxfinder.com
	bbox: [-3.886049,57.006752,-3.673875,57.184492],
	// additional projections, options include 'latlng' (default), 'mercator', 'web-mercator' and any proj4-valid cylindrical projection: https://www.npmjs.com/package/proj4
	projection: 'web-mercator',
	// alternate viewpoints, options include 'south' (default), 'west', 'north', and 'east'
	viewpoint: 'north'
})
await map.getElevationData({
	// number of lines (top to bottom), default 80
	num: 100,
	// number of points each line (left to right), default 300
	points: 100,
	// where to cache .hgt files, defaults to ~/cache/srtm
	cache: './hgt-cache/'
})
await map.generate({
	// control how exaggerated vertical differences are, increase to make more dramatic. Default 40
	verticalRatio: 100,
	// delete the provided number of meters of data, useful for coasts, lakes or rivers. Set to 0 to disable (default)
	waterNTile: 1,
	// How few meters lines can change vertically within 3 points before removing, useful for elevated lakes and rivers. Set to 0 to disable (default)
	lakeFlatness: 0.2,
	// colour of lines, supporting any valid CSS colour format, default black
	lineColour: '#f00',
	// width of lines, as used on an SVG canvas with width 100, default 0.1
	lineWidth: 1
})
//
await map.save({
	// filename to output
	name: 'our-output.svg',
	// whether to optimise SVG using SVGO, producing smaller, nicer outputs. Defaults to true
	svgo: false
})
```

## Examples

<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
	<a href="https://github.com/accudio/ridge-map/raw/main/examples/british-isles.md">
		<img src="https://github.com/accudio/ridge-map/raw/main/.assets/british-isles-square.png" width="800" height="800" loading="lazy" alt="The British Isles in white on navy">
	</a>
	<a href="https://github.com/accudio/ridge-map/raw/main/examples/vanoise.md">
		<img src="https://github.com/accudio/ridge-map/raw/main/.assets/vanoise-square.png" width="800" height="800" loading="lazy" alt="Vanoise national park in black on white">
	</a>
	<a href="https://github.com/accudio/ridge-map/raw/main/examples/cairngorms.md">
		<img src="https://github.com/accudio/ridge-map/raw/main/.assets/cairngorms-square.png" width="800" height="800" loading="lazy" alt="Cairngorm Mountains in Red on pale orange">
	</a>
	<a href="https://github.com/accudio/ridge-map/raw/main/examples/white-mountains.md">
		<img src="https://github.com/accudio/ridge-map/raw/main/.assets/white-mountains-square.png" width="800" height="800" loading="lazy" alt="The White Mountains black on light grey">
	</a>
</div>

## Elevation data

Elevation data is looked up by `.hgt` files in the specified or default cache directory using the node package node-hgt. If data isn't available locally, it will be downloaded from [imagico.de](https://www.imagico.de) which includes composite data from several different sources. This covers pretty much all land globally, however the quality varies depending on location.

You can provide your own data by providing `.hgt` files in the cache directory with the default file names. For example you can download [higher-quality elevation data for Europe from Sonny](https://sonny.4lima.de) in 1" or 3" format.

## License and Contributing

This project is licensed under the MIT license. The full license is included at [LICENSE.md](https://github.com/accudio/ridge-map), or at [mit-license.org](https://mit-license.org).

Contributions are accepted, this is a list of potential additions or improvements that would be great to make:

- Arbitrary viewpoints — cardinal directions are supported but can we support an arbitrary viewpoint of 45 degrees (from north-east) for example?
- Performance — particularly for lots of lines and points ridge-map is pretty slow and can run into issues. It would be great to improve this!
- Perspective — add perspective so rear lines should be scaled down and closer together than the front lines.
- Map projections — I don't know if it would be possible but it would be cool if the library could support more map projections including non-cylindrical ones.