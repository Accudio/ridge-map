# The White Mountains, New Hampshire

> Has slight edits where the libraries differ to show matching the ridge_map python example

<img src="https://github.com/accudio/ridge-map/raw/main/.assets/vanoise.png" width="2000" height="1161" loading="eager" alt="The White Mountains black on light grey">

```js
import RidgeMap from 'ridge-map'

const map = new RidgeMap({
	bbox: [-71.928864, 43.758201, -70.957947, 44.465151]
})
await map.getElevationData()
await map.generate({
	verticalRatio: 600,
	waterNTile: 50,
	lakeFlatness: 0.5
})
await map.save()
```