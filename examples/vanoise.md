# Vanoise National Park

<img src="https://github.com/accudio/ridge-map/raw/main/.assets/vanoise.png" width="2000" height="1161" loading="eager" alt="Vanoise national park in black on white">

```js
import RidgeMap from 'ridge-map'

const map = new RidgeMap({
	bbox: [6.575199,45.221755,7.257038,45.600632]
})
await map.getElevationData()
await map.generate()
await map.save()
```