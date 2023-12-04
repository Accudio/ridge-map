# Cairngorm Mountains

<img src="https://github.com/accudio/ridge-map/raw/main/.assets/cairngorms.png" width="2000" height="857" loading="eager" alt="Cairngorm Mountains in Red on pale orange">

```js
import RidgeMap from 'ridge-map'

const map = new RidgeMap({
	bbox: [-3.897496,57.026368,-3.558980,57.161777],
	viewpoint: 'north'
})
await map.getElevationData({
	num: 100
})
await map.generate({
	verticalRatio: 100,
	lakeFlatness: 0.5,
	waterNTile: 0,
	lineColor: '#ED5F37',
	backgroundColor: '#FFE9E0'
})
await map.save()
```