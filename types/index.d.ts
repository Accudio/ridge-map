export default RidgeMap;
declare class RidgeMap {
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
    constructor({ bbox, projection, viewpoint }: {
        bbox: [number, number, number, number];
        projection?: string;
    });
    pos1: [number, number];
    pos2: [number, number];
    projection: string;
    viewpoint: any;
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
    public getElevationData({ num, points, cache }?: {
        num?: number;
        points?: number;
    }): Promise<void>;
    _data: number[][];
    /**
     * Generate ridge lines within paper.js
     *
     * @async
     * @public
     * @param {object} [param0={}]
     * @param {number} [param0.lakeFlatness=0] - Remove flat segments from lines, useful for elevated lakes and rivers. Will remove any segments where the elevation changes by the provided number of meters across 3 elevation points. Set to 0 to disable, default 0
     * @param {number} [param0.verticalRatio=40] - Scales elevation changes vertically to exaggerate them. Higher numbers will result in more vertical difference. Default 40
     * @param {number} [param0.waterNTile=0] - Remove the bottom n meters, useful for sea, lakes and rivers. Set to 0 to disable, default 0
     * @param {string} [param0.lineColour=black] - Colour of lines, supporting any valid CSS colour format. Default black
     * @param {number} [param0.lineWidth=0.1] - Width of lines, as used on an SVG canvas with width 100. Default 0.1
     */
    public generate({ lakeFlatness, verticalRatio, waterNTile, lineColour, lineWidth }?: {
        lakeFlatness?: number;
        verticalRatio?: number;
        waterNTile?: number;
        lineColour?: string;
        lineWidth?: number;
    }): Promise<void>;
    _paper: any;
    /**
     * Generate SVG of ridge map, saving to the current directory
     *
     * @async
     * @public
     * @param {object} [param0={}]
     * @param {string} [param0.name='ridge-map.svg'] - Filename to output to. Default ridge-map.svg
     * @param {boolean} [param0.svgo=true] - Whether to optimise and compress the output with SVGO. Default true
     */
    public save({ name, svgo }?: {
        name?: string;
        svgo?: boolean;
    }): Promise<void>;
    #private;
}
