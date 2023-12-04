# British Isles

<img src="https://github.com/accudio/ridge-map/raw/main/.assets/british-isles.png" width="2000" height="3028" loading="eager" alt="The British Isles in white on navy">

```js
import RidgeMap from 'ridge-map'

const map = new RidgeMap({
	bbox: [-10.585327,49.874061,2.002602,60.853314],
	projection: 'web-mercator'
})
await map.getElevationData({
	num: 150,
})
await map.generate({
	waterNTile: 0.01,
	lakeFlatness: 0,
	verticalRatio: 10,
	lakeFlatness: 1,
	lineWidth: 0.3,
	lineColor: '#fff',
	backgroundColor: '#151B3A'
})
await map.save()
```