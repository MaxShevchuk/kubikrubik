/*
 * CFOP/Fridrich solver bundled from slammayjammay/rubiks-cube-solver.
 * Copyright and MIT license:
 * MIT License
 * 
 * Copyright (c) Scott McKenzie
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */
(function(global){'use strict';
const factories={
"src/Solver.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { CrossSolver } = require("src/solvers/cross/index.js");
const { F2LSolver } = require("src/solvers/f2l/index.js");
const { OLLSolver } = require("src/solvers/oll/index.js");
const { PLLSolver } = require("src/solvers/pll/index.js");
const { normalizeNotations } = require("src/utils/index.js");
const { algorithmShortener } = require("src/algorithm-shortener.js");

class Solver {
	/**
	 * @param {string|RubiksCube} cubeState - Can be one of 3 things:
	 * 1) A string representing a Rubik's Cube state.
	 * 2) A string containing a list of moves to make from a solved state to
	 *    identify a cube state.
	 * 3) An instance of a RubiksCube.
	 */
	constructor(cubeState, options) {
		if (cubeState instanceof RubiksCube) {
			this.cube = cubeState;
		} else if (typeof cubeState === 'string') {
			// if there are spaces present in cubeState, assume it's a set of
			// scramble moves.
			// it's possible that one or no scramble moves are present.
			let magicNum = 6; // longest possible move string -- e.g. Rprime
			if (cubeState.split(' ').length > 1 || cubeState.length <= magicNum) {
				this.cube = RubiksCube.Solved();
				this.cube.move(cubeState);
			} else {
				this.cube = new RubiksCube(cubeState);
			}
		} else {
			throw new Error('"cubeState" is not a valid cubeState. Please provide a list of scramble moves or a string representing a cube state');
		}

		this.options = options;
		this.phases = ['cross', 'f2l', 'oll', 'pll'];
		this.progress = {};

		this.phases.forEach(phase => this.progress[phase] = []);

		// save each partition to this.progress after each solve
		const afterEach = (partition, phase) => {
			this._updateProgress(partition, phase);
		};

		this.currentPhase = null; // good for debugging
		this.currentSolver = null; // good for debugging

		this.crossSolver = new CrossSolver(this.cube, this.options);
		this.f2lSolver = new F2LSolver(this.cube, this.options);
		this.ollSolver = new OLLSolver(this.cube, this.options);
		this.pllSolver = new PLLSolver(this.cube, this.options);

		this.afterEach('all', afterEach);
	}

	afterEach(phases, callback) {
		// argument parsing
		if (typeof phases === 'function') {
			// if first argument is a function, default phases to 'all'
			callback = phases;
			phases = 'all';
		} else if (typeof phases === 'string') {
			if (phases === 'all') {
				// 'all': shortcut for array of all phases
				phases = this.phases.slice();
			} else {
				// lastly turn phases into an array
				phases = [phases];
			}
		}

		// error handling
		if (typeof callback !== 'function') {
			throw new Error('"afterEach" callback is not a function.');
		}

		// error handling
		for (let phase of phases) {
			if (!this.phases.includes(phase)) {
				throw new Error(`Phase "${phase}" isn't recognized. Please specify "cross", "f2l", "oll", "pll", or "all".`);
			}
		}

		// if everything has gone okay, add the callback
		for (let phase of phases) {
			let solver = this[`${phase}Solver`];
			solver.afterEach(callback);
		}
	}

	solve() {
		this.currentPhase = 'cross';
		this.currentSolver = this.crossSolver;
		this.crossSolver.solve();

		this.currentPhase = 'f2l';
		this.currentSolver = this.f2lSolver;
		this.f2lSolver.solve();

		this.currentPhase = 'oll';
		this.currentSolver = this.ollSolver;
		this.ollSolver.solve();

		this.currentPhase = 'pll';
		this.currentSolver = this.pllSolver;
		this.pllSolver.solve();
	}

	getMoves() {
		let moves = [];

		Object.keys(this.progress).forEach(phase => {
			let partitions = this.progress[phase];
			partitions.forEach(partition => moves.push(...partition.moves));
		});

		moves = normalizeNotations(moves);

		return moves.join(' ');
	}

	getPartitions() {
		let ret = {};
		let phases = Object.keys(this.progress);
		phases.forEach(phase => {
			let partitions = this.progress[phase];

			if (partitions.length === 1) {
				ret[phase] = algorithmShortener(partitions[0].moves);
			} else {
				let phaseMoves = [];
				this.progress[phase].forEach(partition => {
					phaseMoves.push(algorithmShortener(partition.moves));
				});
				ret[phase] = phaseMoves;
			}
		});

		return ret;
	}

	isCrossEdgeSolved(edge) {
		return this.crossSolver.isEdgeSolved(edge);
	}

	isF2LPairSolved({ corner, edge }) {
		return this.f2lSolver.isPairSolved({ corner, edge });
	}

	isOLLSolved() {
		return this.ollSolver.isSolved();
	}

	isPLLSolved() {
		return this.pllSolver.isSolved();
	}

	_updateProgress(partition, phase) {
		this.progress[phase].push(partition);
	}
}
module.exports["Solver"] = Solver;

module.exports["Solver"] = Solver;
},
"src/algorithm-shortener.js":function(require,module,exports){
const combiner = require("deps/array-element-combiner.js").default;

const parallelMoves = {
	F: 'B',
	R: 'L',
	U: 'D'
};

/**
 * @param {array|string} notations - The array of move notations.
 * @return {string}
 */
const algorithmShortener = (notations) => {
	if (typeof notations === 'string') {
		notations = notations.split(' ');
	}

	const options = {
		compare(a, b) {
			return a[0] === b[0];
		},
		combine(a, b) {
			const aDir = a.includes('2') ? 2 : (a.includes('prime') ? -1 : 1);
			const bDir = b.includes('2') ? 2 : (b.includes('prime') ? -1 : 1);

			let totalDir = aDir + bDir;

			if (totalDir === 4) totalDir = 0;
			if (totalDir === -2) totalDir = 2;
			if (totalDir === 3) totalDir = -1;

			if (totalDir === 0) {
				return '';
			}

			let dirString = totalDir === 2 ? '2' : (totalDir === -1 ? 'prime' : '');

			return `${a[0]}${dirString}`;
		},
		cancel(value) {
			return value === '';
		},
		ignore(a, b) {
			return (parallelMoves[a[0]] === b[0] || parallelMoves[b[0]] === a[0]);
		}
	};

	return combiner(notations, options).join(' ');
};
module.exports["algorithmShortener"] = algorithmShortener;

module.exports["algorithmShortener"] = algorithmShortener;
},
"src/index.js":function(require,module,exports){
const { Solver } = require("src/Solver.js");
const { algorithmShortener } = require("src/algorithm-shortener.js");

// solver constructor
module.exports["Solver"] = Solver;

// models
module.exports["Cubie"] = require("src/models/Cubie.js")["Cubie"];
module.exports["RubiksCube"] = require("src/models/RubiksCube.js")["RubiksCube"];

// solvers
module.exports["CrossSolver"] = require("src/solvers/cross/index.js")["CrossSolver"];
module.exports["F2LSolver"] = require("src/solvers/f2l/index.js")["F2LSolver"];
module.exports["OLLSolver"] = require("src/solvers/oll/index.js")["OLLSolver"];
module.exports["PLLSolver"] = require("src/solvers/pll/index.js")["PLLSolver"];

// algorithm shortener
module.exports["algorithmShortener"] = require("src/algorithm-shortener.js")["algorithmShortener"];

/**
 * @param {string} cubeState - The string representing a cube state.
 * @param {object} options
 * @prop {boolean} options.partitioned - Whether to separate moves according to
 * phase.
 */
module.exports.default = (cubeState, options = {}) => {
	let solver = new Solver(cubeState, options);
	solver.solve();

	if (options.partitioned) {
		return solver.getPartitions();
	} else {
		return algorithmShortener(solver.getMoves());
	}
};

module.exports["Solver"] = Solver;
},
"src/models/Cubie.js":function(require,module,exports){
const { Vector } = require("src/models/Vector.js");
const { Face } = require("src/models/Face.js");

class Cubie {
	/**
	 * Factory method. Returns an instance of a cubie identified by the faces it
	 * sits on.
	 * @param {array} faces - A list of all the faces this cubie sits on.
	 */
	static FromFaces(faces) {
		let position = new Vector([0, 0, 0]);
		let colorMap = {};

		for (let face of faces) {
			if (!face) {
				continue;
			}

			let temp = new Face(face);
			let axis = temp.vector.getAxis().toUpperCase();
			position[`set${axis}`](temp.vector.getMagnitude());

			colorMap[face.toLowerCase()] = temp.toString()[0].toLowerCase();
		}

		return new Cubie({ position: position.toArray(), colorMap });
	}

	/**
	 * @param {object} [options]
	 * @param {object} options.position - The cubie's position.
	 * @param {object} options.colorMap - A map with faces as keys and colors
	 * as values. For example: { 'front' : 'f' }.
	 */
	constructor({ position, colorMap = {} }) {
		this.position(position);
		this.colorMap = {};

		Object.keys(colorMap).forEach(face => {
			let color = colorMap[face];
			this.colorFace(face, color);
		});
	}

	/**
	 * @return {Cubie}
	 */
	clone() {
		return new Cubie({
			position: this.position(),
			colorMap: this.colorMap
		});
	}

	/**
	 * Getter/setter for the vector position.
	 * @param {array} [position] - The new position to store.
	 * @return {array}
	 */
	position(position) {
		if (typeof position === 'undefined') {
			return this.vector ? this.vector.toArray() : this.vector;
		}

		this.vector = new Vector(position);
	}

	/**
	 * @return {number}
	 */
	getX() {
		return this.vector.getX();
	}

	/**
	 * @return {number}
	 */
	getY() {
		return this.vector.getY();
	}

	/**
	 * @return {number}
	 */
	getZ() {
		return this.vector.getZ();
	}

	/**
	 * @return {boolean}
	 */
	isCorner() {
		return Object.keys(this.colorMap).length === 3;
	}

	/**
	 * @return {boolean}
	 */
	isEdge() {
		return Object.keys(this.colorMap).length === 2;
	}

	/**
	 * @return {boolean}
	 */
	isMiddle() {
		return Object.keys(this.colorMap).length === 1;
	}

	/**
	 * @return {array}
	 */
	colors() {
		return Object.keys(this.colorMap).map(face => this.colorMap[face]);
	}

	/**
	 * @param {string} color - Check if the cubie has this color.
	 * @return {boolean}
	 */
	hasColor(color) {
		color = color.toLowerCase();

		for (let face of Object.keys(this.colorMap)) {
			if (this.colorMap[face] === color) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param {string} face - Check if the cubie has this face.
	 * @return {boolean}
	 */
	hasFace(face) {
		face = face.toLowerCase();
		return Object.keys(this.colorMap).includes(face);
	}

	/**
	 * Sets a color on a given face or normal of a cubie.
	 * @param {string} face - The face of the cubie we want to set the color on.
	 * @param {string} color - The color we want to set.
	 * @return {Cubie}
	 */
	colorFace(face, color) {
		face = face.toLowerCase();
		color = color.toLowerCase();

		this.colorMap[face] = color;
		return this;
	}

	/**
	 * @param {string} face - The color on the face this cubie sits on.
	 * @return {string}
	 */
	getColorOfFace(face) {
		face = face.toLowerCase();

		return this.colorMap[face];
	}

	/**
	 * @param {string} color - Find the face that this color sits on.
	 * @return {string}
	 */
	getFaceOfColor(color) {
		color = color.toLowerCase();

		return Object.keys(this.colorMap).find(cubieColor => {
			return this.colorMap[cubieColor] === color;
		});
	}

	/**
	 * Return all the faces this cubie sits on.
	 * @return {array}
	 */
	faces() {
		return Object.keys(this.colorMap);
	}

	/**
	 * Rotates the position vector around `axis` by `angle`. Updates the internal
	 * position vector and the normal-color map.
	 * @param {string} axis - The axis of rotation.
	 * @param {number} angle - The magnitude of rotation.
	 * @return {null}
	 */
	rotate(axis, angle) {
		// update position vector after rotation
		this.vector.rotate(axis, angle);

		// update normal-color map
		let newMap = {}; // need to completely overwrite the old one

		// go through each normal, rotate it, and assign the new normal the old color
		for (let face of Object.keys(this.colorMap)) {
			let color = this.colorMap[face];
			let faceModel = new Face(face);

			let newNormal = faceModel.rotate(axis, angle).normal().join(' ');
			let newFace = Face.FromNormal(newNormal).toString().toLowerCase();

			newMap[newFace] = color;
		}

		this.colorMap = {};
		Object.keys(newMap).forEach(face => this.colorFace(face, newMap[face]));
	}
}
module.exports["Cubie"] = Cubie;

module.exports["Cubie"] = Cubie;
},
"src/models/Face.js":function(require,module,exports){
const { Vector } = require("src/models/Vector.js");

const faceToNormal = {
	front: '0 0 1',
	right: '1 0 0',
	up: '0 1 0',
	down: '0 -1 0',
	left: '-1 0 0',
	back: '0 0 -1'
};

class Face {
	/**
	 * Factory method.
	 * @param {string|array} normal - The normal that identifies this face.
	 * @return {Face}
	 */
	static FromNormal(normal) {
		if (typeof normal === 'string') {
			normal = Vector.FromString(normal).toArray();
		}

		return new Face(Face.getFace(normal));
	}

	/**
	 * @param {string} face - A string that identifies a face.
	 * @return {array}
	 */
	static getNormal(face) {
		return Vector.FromString(faceToNormal[face]).toArray();
	}

	/**
	 * @param {string|array} normal - The normal that identifies a face.
	 * @return {string}
	 */
	static getFace(normal) {
		if (typeof normal === 'string') {
			normal = Vector.FromString(normal).toArray();
		}

		for (let face of Object.keys(faceToNormal)) {
			if (normal.join(' ') === faceToNormal[face]) {
				return face;
			}
		}
	}

	/**
	 * @param {string} face - The string of a face, e.g. 'RIGHT'.
	 */
	constructor(face) {
		if (typeof face !== 'string') {
			throw new Error(`"face" must be a string (received: ${face})`);
		}

		face = face.toLowerCase();

		this.vector = Vector.FromString(faceToNormal[face]);
	}

	/**
	 * Method to return the normal as an array.
	 * @return {array}
	 */
	normal() {
		return this.vector.toArray();
	}

	/**
	 * @return {string}
	 */
	toString() {
		return Face.getFace(this.normal());
	}

	/**
	 * Simulates an orientation change where this face becomes the new given face.
	 * NOTE: this only changes this face's normals, not any cubies' positions.
	 * @param {string|Face} face - The new face, e.g. 'FRONT'
	 */
	orientTo(newFace) {
		if (typeof newFace === 'string') {
			newFace = new Face(newFace);
		}

		let { axis, angle } = Vector.getRotationFromNormals(this.normal(), newFace.normal());
		this.vector.rotate(axis, angle);
		return this;
	}

	/**
	 * Convenience method for rotating this face. NOTE: this only changes this
	 * face's normals, not any cubies' positions.
	 * @param {string} axis - Axis of rotation.
	 * @param {number} angle - Angle of rotation.
	 * @return {Face}
	 */
	rotate(axis, angle) {
		this.vector.rotate(axis, angle);
		return this;
	}
}

Face.FRONT = new Face('FRONT');
Face.RIGHT = new Face('RIGHT');
Face.UP = new Face('UP');
Face.DOWN = new Face('DOWN');
Face.LEFT = new Face('LEFT');
Face.BACK = new Face('BACK');
module.exports["Face"] = Face;

module.exports["Face"] = Face;
},
"src/models/RubiksCube.js":function(require,module,exports){
const { Cubie } = require("src/models/Cubie.js");
const { algorithmShortener } = require("src/algorithm-shortener.js");
const { transformNotations, getMiddleMatchingFace } = require("src/utils/index.js");

const SOLVED_STATE = 'fffffffffrrrrrrrrruuuuuuuuudddddddddlllllllllbbbbbbbbb';

class RubiksCube {
	/**
	 * Factory method. Returns an instance of a solved Rubiks Cube.
	 */
	static Solved() {
		return new RubiksCube(SOLVED_STATE);
	}

	/**
	 * Factory method.
	 * @param {string|array} moves
	 */
	static FromMoves(moves) {
		const cube = RubiksCube.Solved();
		cube.move(moves);
		return cube;
	}

	/**
	 * Factory method. Returns an instance of a scrambled Rubiks Cube.
	 */
	static Scrambled() {
		let cube = RubiksCube.Solved();
		let randomMoves = RubiksCube.getRandomMoves(25);
		cube.move(randomMoves);

		return cube;
	}

	/**
	 * @param {string|array} notations - The list of moves to reverse.
	 * @return {string|array} -- whichever was initially given.
	 */
	static reverseMoves(moves) {
		return RubiksCube.transformMoves(moves, { reverse: true });
	}

	/**
	 * @param {string|array} moves - The moves to transform;
	 * @param {object} options
	 * @prop {boolean} options.upperCase - Turn lowercase moves into uppercase.
	 * @prop {object} options.orientation - An object describing the orientation
	 * from which to makes the moves. See src/js/utils#orientMoves.
	 *
	 * @return {string|array} -- whichever was initially given.
	 */
	static transformMoves(moves, options = {}) {
		return transformNotations(moves, options);
	}

	static getRandomMoves(length = 25) {
		let randomMoves = [];
		let totalMoves = [
			'F',
			'Fprime',
			'R',
			'Rprime',
			'U',
			'Uprime',
			'D',
			'Dprime',
			'L',
			'Lprime',
			'B',
			'Bprime'
		];

		while (randomMoves.length < length) {
			for (let i = 0; i < length - randomMoves.length; i++) {
				let idx = ~~(Math.random() * totalMoves.length);
				randomMoves.push(totalMoves[idx]);
			}

			randomMoves = algorithmShortener(randomMoves).split(' ');
		}

		return randomMoves.join(' ');
	}

	/**
	 * @param {string} cubeState - The string representing the Rubik's Cube.
	 *
	 * The cube state are represented as:
	 * 'FFFFFFFFFRRRRRRRRRUUUUUUUUUDDDDDDDDDLLLLLLLLLBBBBBBBBB'
	 *
	 * where:
	 * F stands for the FRONT COLOR
	 * R stands for the RIGHT COLOR
	 * U stands for the UP COLOR
	 * D stands for the DOWN COLOR
	 * L stands for the LEFT COLOR
	 * B stands for the BACK COLOR
	 *
	 * and the faces are given in the order of:
	 * FRONT, RIGHT, UP, DOWN, LEFT, BACK
	 *
	 * The order of each color per face is ordered by starting from the top left
	 * corner and moving to the bottom right, as if reading lines of text.
	 *
	 * See this example: http://2.bp.blogspot.com/_XQ7FznWBAYE/S9Sbric1KNI/AAAAAAAAAFs/wGAb_LcSOwo/s1600/rubik.png
	 */
	constructor(cubeState) {
		if (cubeState.length !== 9 * 6) {
			throw new Error('Wrong number of colors provided');
		}

		this._notationToRotation = {
			f: { axis: 'z', mag: -1 },
			r: { axis: 'x', mag: -1 },
			u: { axis: 'y', mag: -1 },
			d: { axis: 'y', mag: 1 },
			l: { axis: 'x', mag: 1 },
			b: { axis: 'z', mag: 1 },
			m: { axis: 'x', mag: 1 },
			e: { axis: 'y', mag: 1 },
			s: { axis: 'z', mag: -1 }
		};

		this._build(cubeState);
	}

	/**
	 * Grab all the cubes on a given face, and return them in order from top left
	 * to bottom right.
	 * @param {string} face - The face to grab.
	 * @return {array}
	 */
	getFace(face) {
		if (typeof face !== 'string') {
			throw new Error(`"face" must be a string (received: ${face})`);
		}

		face = face.toLowerCase()[0];

		// The 3D position of cubies and the way they're ordered on each face
		// do not play nicely. Below is a shitty way to reconcile the two.
		// The way the cubies are sorted depends on the row and column they
		// occupy on their face. Cubies on a higher row will have a lower sorting
		// index, but rows are not always denoted by cubies' y position, and
		// "higher rows" do not always mean "higher axis values".

		let row, col, rowOrder, colOrder;
		let cubies;

		// grab correct cubies
		if (face === 'f') {
			[row, col, rowOrder, colOrder] = ['Y', 'X', -1, 1];
			cubies = this._cubies.filter(cubie => cubie.getZ() === 1);
		} else if (face === 'r') {
			[row, col, rowOrder, colOrder] = ['Y', 'Z', -1, -1];
			cubies = this._cubies.filter(cubie => cubie.getX() === 1);
		} else if (face === 'u') {
			[row, col, rowOrder, colOrder] = ['Z', 'X', 1, 1];
			cubies = this._cubies.filter(cubie => cubie.getY() === 1);
		} else if (face === 'd') {
			[row, col, rowOrder, colOrder] = ['Z', 'X', -1, 1];
			cubies = this._cubies.filter(cubie => cubie.getY() === -1);
		} else if (face === 'l') {
			[row, col, rowOrder, colOrder] = ['Y', 'Z', -1, 1];
			cubies = this._cubies.filter(cubie => cubie.getX() === -1);
		} else if (face === 'b') {
			[row, col, rowOrder, colOrder] = ['Y', 'X', -1, -1];
			cubies = this._cubies.filter(cubie => cubie.getZ() === -1);
		} else if (['m', 'e', 's'].includes(face)) {
			return this._getMiddleCubiesForMove(face);
		}

		// order cubies from top left to bottom right
		return cubies.sort((first, second) => {
			let firstCubieRow = first[`get${row}`]() * rowOrder;
			let firstCubieCol = first[`get${col}`]() * colOrder;

			let secondCubieRow = second[`get${row}`]() * rowOrder;
			let secondCubieCol = second[`get${col}`]() * colOrder;

			if (firstCubieRow < secondCubieRow) {
				return -1;
			} else if (firstCubieRow > secondCubieRow) {
				return 1;
			} else {
				return firstCubieCol < secondCubieCol ? -1 : 1;
			}
		});
	}

	/**
	 * @param {array} faces - The list of faces the cubie belongs on.
	 */
	getCubie(faces) {
		return this._cubies.find(cubie => {
			if (faces.length != cubie.faces().length) {
				return false;
			}

			for (let face of faces) {
				if (!cubie.faces().includes(face)) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Finds and returns all cubies with three colors.
	 * @return {array}
	 */
	corners() {
		return this._cubies.filter(cubie => cubie.isCorner());
	}

	/**
	 * Finds and returns all cubies with two colors.
	 * @return {array}
	 */
	edges() {
		return this._cubies.filter(cubie => cubie.isEdge());
	}

	/**
	 * Finds and returns all cubies with one color.
	 * @return {array}
	 */
	middles() {
		return this._cubies.filter(cubie => cubie.isMiddle());
	}

	/**
	 * Gets the rotation axis and magnitude of rotation based on notation.
	 * Then finds all cubes on the correct face, and rotates them around the
	 * rotation axis.
	 * @param {string|array} notations - The move notation.
	 * @param {object} options - Move options.
	 * @prop {boolean} options.upperCase - Turn all moves to upper case (i.e. no "double" moves).
	 */
	move(notations, options = {}) {
		if (typeof notations === 'string') {
			notations = notations.split(' ');
		}

		notations = transformNotations(notations, options);

		for (let notation of notations) {
			let move = notation[0];

			if (!move) {
				continue;
			}

			let isPrime = notation.toLowerCase().includes('prime');
			let isWithMiddle = move === move.toLowerCase();
			let isDoubleMove  = notation.includes('2');

			let { axis, mag } = this._getRotationForFace(move);
			let cubesToRotate = this.getFace(move);

			if (isPrime) mag *= -1;
			if (isDoubleMove) mag *= 2;

			if (isWithMiddle) {
				let middleMove = getMiddleMatchingFace(move);
				let middleCubies = this._getMiddleCubiesForMove(middleMove);
				cubesToRotate = [...cubesToRotate, ...middleCubies];
			}

			for (let cubie of cubesToRotate) {
				cubie.rotate(axis, mag);
			}
		}
	}

	isSolved() {
		return this.toString() === SOLVED_STATE;
	}

	toString() {
		let cubeState = '';

		let faces = ['front', 'right', 'up', 'down', 'left', 'back'];
		for (let face of faces) {
			let cubies = this.getFace(face);
			for (let cubie of cubies) {
				cubeState += cubie.getColorOfFace(face);
			}
		}

		return cubeState;
	}

	clone() {
		return new RubiksCube(this.toString());
	}

	/**
	 * Create a "virtual" cube, with individual "cubies" having a 3D coordinate
	 * position and 1 or more colors attached to them.
	 */
	_build(cubeState) {
		this._cubies = [];
		this._populateCube();

		let parsedColors = this._parseColors(cubeState);

		for (let face of Object.keys(parsedColors)) {
			let colors = parsedColors[face];
			this._colorFace(face, colors);
		}
	}

	/**
	 * Populates the "virtual" cube with 26 "empty" cubies by their position.
	 * @return {null}
	 */
	_populateCube() {
		for (let x = -1; x <= 1; x++) {
			for (let y = -1; y <= 1; y++) {
				for (let z = -1; z <= 1; z++) {
					// no cubie in the center of the rubik's cube
					if (x === 0 && y === 0 && z === 0) {
						continue;
					}

					let cubie = new Cubie({ position: [x, y, z] });
					this._cubies.push(cubie);
				}
			}
		}
	}

	/**
	 * @return {object} - A map with faces for keys and colors for values
	 */
	_parseColors(cubeState) {
		let faceColors = {
			front: [],
			right: [],
			up: [],
			down: [],
			left: [],
			back: []
		};

		let currentFace;

		for (let i = 0; i < cubeState.length; i++) {
			let color = cubeState[i];

			if (i < 9) {
				currentFace = 'front';
			} else if (i < 9 * 2) {
				currentFace = 'right';
			} else if (i < 9 * 3) {
				currentFace = 'up';
			} else if (i < 9 * 4) {
				currentFace = 'down';
			} else if (i < 9 * 5) {
				currentFace = 'left';
			} else {
				currentFace = 'back';
			}

			faceColors[currentFace].push(color);
		}

		return faceColors;
	}

	/**
	 * @param {array} face - An array of the cubies on the given face.
	 * @param {array} colors - An array of the colors on the given face.
	 */
	_colorFace(face, colors) {
		let cubiesToColor = this.getFace(face);
		for (let i = 0; i < colors.length; i++) {
			cubiesToColor[i].colorFace(face, colors[i]);
		}
	}

	/**
	 * @return {object} - The the rotation axis and magnitude for the given face.
	 */
	_getRotationForFace(face) {
		if (typeof face !== 'string') {
			throw new Error(`"face" must be a string (received: ${face})`);
		}

		face = face.toLowerCase();

		return {
			axis: this._notationToRotation[face].axis,
			mag: this._notationToRotation[face].mag * Math.PI / 2
		};
	}

	_getMiddleCubiesForMove(move) {
		move = move[0].toLowerCase();

		let nonMiddles;
		if (move === 'm') {
			nonMiddles = ['left', 'right'];
		} else if (move === 'e') {
			nonMiddles = ['up', 'down'];
		} else if (move === 's') {
			nonMiddles = ['front', 'back'];
		}

		return this._cubies.filter(cubie => {
			return !cubie.hasFace(nonMiddles[0]) && !cubie.hasFace(nonMiddles[1]);
		});
	}
}
module.exports["RubiksCube"] = RubiksCube;

module.exports["RubiksCube"] = RubiksCube;
},
"src/models/Vector.js":function(require,module,exports){
const angle = require("deps/gl-vec3/angle.js").default;
const cross = require("deps/gl-vec3/cross.js").default;
const rotateX = require("deps/gl-vec3/rotateX.js").default;
const rotateY = require("deps/gl-vec3/rotateY.js").default;
const rotateZ = require("deps/gl-vec3/rotateZ.js").default;

const rotate = {
	x: rotateX,
	y: rotateY,
	z: rotateZ
};

class Vector {
	/**
	 * Factory method.
	 * @param {string} vector - Space-deliminated x, y, and z values.
	 * @return {Vector}
	 */
	static FromString(vector) {
		return new Vector(vector.split(' ').map(value => parseInt(value)));
	}

	/**
	 * @param {array} vector1 - Vector 1.
	 * @param {array} vector2 - Vector 2.
	 * @return {boolean}
	 */
	static areEqual(vector1, vector2) {
		return vector1[0] === vector2[0] && vector1[1] === vector2[1] && vector1[2] === vector2[2];
	}

	/**
	 * Helper method. gl-vec3's angle function always returns positive but in many
	 * cases we want the angle in the direction from one vector to another. To get
	 * the sign of the angle, cross the two vectors and determine the direction the
	 * crossed vector, um, directs in. For example, the vector [0, -1, 0] would
	 * shoot negatively along the y-axis.
	 *
	 * @param {array} v1 - Vector 1.
	 * @param {array} v2 - Vector 2.
	 * @return {number}
	 */
	static getAngle(v1, v2) {
		let _angle = angle(v1, v2);
		let crossVector = cross([], v1, v2);
		let sign = new Vector(crossVector).getMagnitude();

		return sign ? _angle * sign : _angle;
	}

	/**
	 * Finds the rotation axis and angle to get from one normal to another.
	 * @param {array} normal1 - The from normal.
	 * @param {array} normal2 - The to normal.
	 * @return {object} - Stores the rotation axis and angle
	 */
	static getRotationFromNormals(normal1, normal2) {
		let axis = new Vector(cross([], normal1, normal2)).getAxis();
		let angle = Vector.getAngle(normal1, normal2);

		// when normal1 is equal to or opposite from normal2, it means 2 things: 1)
		// the cross axis is undefined and 2) the angle is either 0 or PI. This
		// means that rotating around the axis parallel to normal1 will not result
		// in any change, while rotating around either of the other two will work
		// properly.
		if (!axis) {
			let axes = ['x', 'y', 'z'];
			axes.splice(axes.indexOf(new Vector(normal1).getAxis()), 1);
			axis = axes[0];
		}

		return { axis, angle };
	}

	/**
	 * @param {object} rotation - The rotation to reverse.
	 * @return {object}
	 */
	static reverseRotation(rotation) {
		rotation.angle *= -1;
		return rotation;
	}

	/**
	 * @param {array} [vector] - Contains x, y, and z values.
	 */
	constructor(vector) {
		this.set(vector);
	}

	/**
	 * @return {array}
	 */
	toArray() {
		return this.vector;
	}

	/**
	 * @param {array} vector - The new vector to store.
	 */
	set(vector) {
		if (typeof vector === 'undefined') {
			return;
		}

		this.vector = vector.map(value => Math.round(value));
	}

	/**
	 * @param {number} value - The value to store.
	 */
	setX(value) {
		this.vector[0] = value;
	}

	/**
	 * @param {number} value - The value to store.
	 */
	setY(value) {
		this.vector[1] = value;
	}

	/**
	 * @param {number} value - The value to store.
	 */
	setZ(value) {
		this.vector[2] = value;
	}

	/**
	 * @return {number}
	 */
	getX() {
		return this.toArray()[0];
	}

	/**
	 * @return {number}
	 */
	getY() {
		return this.toArray()[1];
	}

	/**
	 * @return {number}
	 */
	getZ() {
		return this.toArray()[2];
	}

	/**
	 * Kind of a flimsy method. If this vector points parallel to an axis, this
	 * returns true. A hacky way to find this is to count the number of 0's and
	 * return true if and only if the count is 2.
	 * @return {boolean}
	 */
	isAxis() {
		let count = 0;
		for (let value of this.vector) {
			if (value === 0) {
				count += 1;
			}
		}

		return count === 2;
	}

	/**
	 * Kind of a flimsy method. If this vector points parallel to an axis, return
	 * that axis.
	 * @return {string}
	 */
	getAxis() {
		if (!this.isAxis()) {
			return;
		}

		if (this.vector[0] !== 0) return 'x';
		if (this.vector[1] !== 0) return 'y';
		if (this.vector[2] !== 0) return 'z';
	}

	/**
	 * Kind of a flimsy method. If this vector points parallel to an axis, return
	 * the magnitude of the value along that axis. (Basically, return whether it
	 * is positive or negative.)
	 * @return {number}
	 */
	getMagnitude() {
		if (!this.isAxis()) {
			return;
		}

		return this[`get${this.getAxis().toUpperCase()}`]();
	}

	/**
	 * @param {string} axis - The axis to rotate around.
	 * @param {number} angle - The angle of rotation.
	 * @return {Vector}
	 */
	rotate(axis, angle) {
		axis = axis.toLowerCase();

		this.set(rotate[axis]([], this.vector, [0, 0, 0], angle));
		return this;
	}
}
module.exports["Vector"] = Vector;

module.exports["Vector"] = Vector;
},
"src/solvers/BaseSolver.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { transformNotations } = require("src/utils/index.js");

class BaseSolver {
	/**
	 * Solves the first step following the Fridrich Method: the cross. Solves the
	 * cross on the UP face by default.
	 *
	 * @param {string|RubiksCube} rubiksCube - This can either be a 54-character
	 * long string representing the cube state (in this case it will have to
	 * "build" another rubik's Cube), or an already built RubiksCube object.
	 */
	constructor(rubiksCube, options = {}) {
		this.cube = typeof rubiksCube === 'string' ? new RubiksCube(rubiksCube) : rubiksCube;
		this.options = options;

		this.partition = {};
		this.partitions = [];
		this.totalMoves = [];
		this._afterEachCallbacks = [];
	}

	/**
	 * @param {string|array} notation - A string of move(s) to execute and store.
	 * @param {object} options - The options to pass to RubiksCube#move.
	 */
	move(notations, options) {
		if (typeof notations === 'string') {
			notations = notations.split(' ');
		}

		this.cube.move(notations, options);

		// this step is also in RubiksCube#move, but it is important we do it here
		// as well. The notations need to be saved to the partition correctly.
		notations = transformNotations(notations, options);

		for (let notation of notations) {
			this.totalMoves.push(notation);
		}
	}

	afterEach(callback) {
		this._afterEachCallbacks.push(callback);
	}

	/**
	 * @param {...*} callbackArgs - The arguments to call the function with.
	 */
	_triggerAfterEach(...callbackArgs) {
		this._afterEachCallbacks.forEach(fn => fn(...callbackArgs));
	}

	/**
	 * Solves the edge and/or corner and returns information about the state
	 * about them right before they are solved. It's important to construct the
	 * object in steps for debugging, so that we can still have access to e.g.
	 * the case number if the solve method fails.
	 */
	_solve(cubies = {}) {

		this.partition = {};
		this.partition.cubies = cubies;

		let { corner, edge } = cubies;

		this.partition.caseNumber = this._getCaseNumber({ corner, edge });

		this._solveCase(this.partition.caseNumber, { corner, edge });
		this.partition.moves = this.totalMoves;

		this.totalMoves = [];

		if (!this._overrideAfterEach) {
			this._triggerAfterEach(this.partition, this.phase);
		}

		return this.partition;
	}

	_solveCase(caseNumber, cubies = {}) {
		let { corner, edge } = cubies;
		this[`_solveCase${caseNumber}`]({ corner, edge });
	}
}
module.exports["BaseSolver"] = BaseSolver;

module.exports["BaseSolver"] = BaseSolver;
},
"src/solvers/cross/index.js":function(require,module,exports){
const { BaseSolver } = require("src/solvers/BaseSolver.js");
const { RubiksCube } = require("src/models/RubiksCube.js");
const { getDirectionFromFaces, getFaceOfMove, getRotationFromTo, getMoveOfFace } = require("src/utils/index.js");

const CROSS_COLOR = 'u';
const R = (moves) => RubiksCube.reverseMoves(moves);

class CrossSolver extends BaseSolver {
	constructor(...args) {
		super(...args);

		this.phase = 'cross';
	}

	solve() {
		let crossEdges = this._getCrossEdges();
		for (let edge of crossEdges) {
			let partition = this._solve({ edge });
			this.partitions.push(partition);
		}

		return this.partitions;
	}

	isSolved() {
		let edges = this._getCrossEdges();
		for (let edge of edges) {
			if (!this.isEdgeSolved(edge)) {
				return false;
			}
		}

		return true;
	}

	isEdgeSolved(edge) {
		let otherColor = edge.colors().find(color => color !== 'u');
		let otherFace = edge.faces().find(face => face !== 'up');
		const matchesMiddle = otherFace[0] === otherColor;
		const isOnCrossFace = edge.getColorOfFace('up') === 'u';

		return isOnCrossFace && matchesMiddle;
	}

	/**
	 * Finds all edges that have 'F' as a color.
	 * @return {array}
	 */
	_getCrossEdges() {
		return this.cube.edges().filter(edge => edge.hasColor(CROSS_COLOR));
	}

	/**
	 * 6 Cases!
	 * 1) The edge's UP color is on the UP face.
	 * 2) the edge's UP color is on the DOWN face.
	 * 3) The edge's UP color is not on the UP or DOWN face and the other color is on the UP face.
	 * 4) The edge's UP color is not on the UP or DOWN face and the other color is on the DOWN face.
	 * 5) The edge's UP color is not on the UP or DOWN face and the other color is on the RELATIVE RIGHT face.
	 * 6) The edge's UP color is not on the UP or DOWN face and the other color is on the RELATIVE LEFT face.
	 *
	 * @param {cubie} edge
	 */
	_getCaseNumber({ edge }) {
		if (edge.getColorOfFace('up') === CROSS_COLOR) {
			return 1;
		} else if (edge.getColorOfFace('down') === CROSS_COLOR) {
			return 2;
		}

		if (edge.faces().includes('up')) {
			return 3;
		} else if (edge.faces().includes('down')) {
			return 4;
		}

		let crossFace = edge.getFaceOfColor(CROSS_COLOR);
		let otherFace = edge.getFaceOfColor(edge.colors().find(color => color !== CROSS_COLOR));
		let direction = getDirectionFromFaces(crossFace, otherFace, { up: 'up' });

		if (direction === 'right') {
			return 5;
		} else if (direction === 'left') {
			return 6;
		}
	}

	_solveCase1({ edge }) {
		if (this.isEdgeSolved(edge)) {
			return;
		}

		let face = edge.faces().find(face => face !== 'up');
		this.move(`${face} ${face}`, { upperCase: true });
		this._solveCase2({ edge });
	}

	_solveCase2({ edge }) {
		let solveMoves = this._case1And2Helper({ edge }, 2);
		this.move(solveMoves, { upperCase: true });
	}

	_solveCase3({ edge }) {
		let prepMove = this._case3And4Helper({ edge }, 3);
		this.move(prepMove, { upperCase: true });
		this._solveCase5({ edge });
	}

	_solveCase4({ edge }) {
		let prepMove = getRotationFromTo(
			'down',
			edge.getFaceOfColor('u'),
			getFaceOfMove(edge.getColorOfFace('down'))
		);
		this.move(prepMove, { upperCase: true });

		let edgeToMiddle = R(edge.getFaceOfColor('u'));

		this.move(edgeToMiddle, { upperCase: true });
		this._solveCase5({ edge });
	}

	_solveCase5({ edge }) {
		let solveMoves = this._case5And6Helper({ edge }, 5);
		this.move(solveMoves, { upperCase: true });
	}

	_solveCase6({ edge }) {
		let solveMoves = this._case5And6Helper({ edge }, 6);
		this.move(solveMoves, { upperCase: true });
	}

	_case1And2Helper({ edge }, caseNum) {
		let crossColorFace = caseNum === 1 ? 'up' : 'down';
		let currentFace = edge.faces().find(face => face !== crossColorFace);
		let targetFace = getFaceOfMove(edge.getColorOfFace(currentFace));

		let solveMoves = getRotationFromTo(crossColorFace, currentFace, targetFace);

		if (caseNum === 2) {
			let edgeToCrossFace = getMoveOfFace(targetFace);
			solveMoves += ` ${edgeToCrossFace} ${edgeToCrossFace}`;
		}

		return solveMoves;
	}

	_case3And4Helper({ edge }, caseNum) {
		let prepMove = edge.faces().find(face => !['up', 'down'].includes(face));

		if (caseNum === 4) {
			prepMove = R(prepMove);
		}

		return prepMove;
	}

	_case5And6Helper({ edge }, caseNum) {
		let otherColor = edge.colors().find(color => color !== 'u');
		let currentFace = edge.getFaceOfColor(otherColor);
		let targetFace = getFaceOfMove(otherColor);

		let prepMove = getRotationFromTo('up', currentFace, targetFace);
		let edgeToCrossFace = getMoveOfFace(currentFace);

		if (caseNum === 6) {
			edgeToCrossFace = R(edgeToCrossFace);
		}

		return `${R(prepMove)} ${edgeToCrossFace} ${prepMove}`;
	}

	_getPartitionBefore({ edge }) {
		return { edge: edge.clone() };
	}

	_getPartitionAfter({ edge }) {
		return { edge };
	}
}
module.exports["CrossSolver"] = CrossSolver;

module.exports["CrossSolver"] = CrossSolver;
},
"src/solvers/f2l/F2LBaseSolver.js":function(require,module,exports){
const { BaseSolver } = require("src/solvers/BaseSolver.js");
const { RubiksCube } = require("src/models/RubiksCube.js");
const { getFaceOfMove, getDirectionFromFaces, getFaceFromDirection, getRotationFromTo, getMoveOfFace } = require("src/utils/index.js");

const R = (moves) => RubiksCube.reverseMoves(moves);

class F2LBaseSolver extends BaseSolver {
	constructor(...args) {
		super(...args);

		this.phase = 'f2l';
	}

	colorsMatch({ corner, edge }) {
		let colors = edge.colors();

		if (corner.colors().includes(colors[0]) && corner.colors().includes(colors[1])) {
			return true;
		}

		return false;
	}

	/**
	 * Returns true only if the pair is matched and in the correct slot.
	 */
	isPairSolved({ corner, edge }) {
		if (!this.isPairMatched({ corner, edge })) {
			return false;
		}

		// is the corner on the cross face?
		if (corner.getFaceOfColor('u') !== 'up') {
			return false;
		}

		// are the edge's colors on the correct face? (e.g. is the edge's 'F' color
		// on the 'FRONT' face)?
		for (let color of edge.colors()) {
			if (edge.getFaceOfColor(color) !== getFaceOfMove(color)) {
				return false;
			}
		}

		return true;
	}

	isPairMatched({ corner, edge }) {
		// are the two non-cross colors the same?
		if (!this.colorsMatch({ corner, edge })) {
			return false;
		}

		// for each color, do the corner and edge share the same face?
		for (let color of edge.colors()) {
			if (corner.getFaceOfColor(color) !== edge.getFaceOfColor(color)) {
				return false;
			}
		}

		return true;
	}

	isPairSeparated({ corner, edge }) {
		// colors must match
		if (!this.colorsMatch({ corner, edge })) {
			return false;
		}

		// corner's white face cannot be UP or DOWN
		if (['up', 'down'].includes(corner.getFaceOfColor('u'))) {
			return false;
		}

		// edge must be on the DOWN face
		if (!edge.faces().includes('down')) {
			return false;
		}


		let otherColor = corner.colors().find(color => {
			return color !== 'u' && corner.getFaceOfColor(color) !== 'down';
		});

		// edge must be oriented properly
		if (edge.getFaceOfColor(otherColor) !== 'down') {
			return false;
		}

		// corner and edge must be one move away from matching
		let isOneMoveFromMatched = getDirectionFromFaces(
			corner.getFaceOfColor(otherColor),
			edge.getFaceOfColor(corner.getColorOfFace('down')),
			{ up: 'up' }
		) === 'back';

		return isOneMoveFromMatched;
	}

	solveMatchedPair({ corner, edge }) {
		if (!this.isPairMatched({ corner, edge })) {
			throw new Error('Pair is not matched');
		}

		// get the color that is not on the down face and is not the crossColor
		let matchedColor = edge.colors().find(color => {
			return edge.getFaceOfColor(color) !== 'down';
		});

		let isLeft = getDirectionFromFaces(
			edge.getFaceOfColor(matchedColor),
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';

		let matchingFace = getFaceOfMove(matchedColor);
		let currentFace = corner.getFaceOfColor(matchedColor);
		let prepFace = getFaceFromDirection(matchingFace, isLeft ? 'left' : 'right', { up: 'down' });

		let prep = getRotationFromTo('down', currentFace, prepFace);
		let open = isLeft ? matchingFace : R(matchingFace);
		let insert = isLeft ? 'DPrime' : 'D';

		let solveMoves = [prep, open, insert, R(open)].join(' ');
		this.move(solveMoves, { upperCase: true });
		return solveMoves;
	}

	solveSeparatedPair({ corner, edge }) {
		if (!this.isPairSeparated({ corner, edge })) {
			throw new Error('Pair is not separated');
		}

		// get the color that is not on the down face and is not the crossColor
		let matchedColor = edge.colors().find(color => {
			return edge.getFaceOfColor(color) !== 'down';
		});

		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor('u'),
			edge.getFaceOfColor(matchedColor),
			{ up: 'down' }
		).toUpperCase() === 'LEFT';

		let currentFace = corner.getFaceOfColor('u');
		let prepFace = getFaceOfMove(matchedColor);

		let prep = getRotationFromTo('down', currentFace, prepFace);
		let match = getMoveOfFace(prepFace);
		match = isLeft ? R(match) : match;
		let insert = isLeft ? 'DPrime' : 'D';

		let solveMoves = [prep, match, insert, R(match)].join(' ');
		this.move(solveMoves, { upperCase: true });
		return solveMoves;
	}

	_getPartitionBefore({ corner, edge }) {
		return {
			corner: corner.clone(),
			edge: edge.clone()
		};
	}

	_getPartitionAfter({ corner, edge }) {
		return { corner, edge };
	}
}
module.exports["F2LBaseSolver"] = F2LBaseSolver;

module.exports["F2LBaseSolver"] = F2LBaseSolver;
},
"src/solvers/f2l/cases/F2LCaseBaseSolver.js":function(require,module,exports){
const { F2LBaseSolver } = require("src/solvers/f2l/F2LBaseSolver.js");

class F2LCaseBaseSolver extends F2LBaseSolver {
	solve({ corner, edge }) {
		return this._solve({ corner, edge });
	}
}
module.exports["F2LCaseBaseSolver"] = F2LCaseBaseSolver;

module.exports["F2LCaseBaseSolver"] = F2LCaseBaseSolver;
},
"src/solvers/f2l/cases/case-1.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { F2LCaseBaseSolver } = require("src/solvers/f2l/cases/F2LCaseBaseSolver.js");
const { getFaceOfMove, getFaceFromDirection, getRotationFromTo, getMoveOfFace, getDirectionFromFaces } = require("src/utils/index.js");

const R = (moves) => RubiksCube.reverseMoves(moves);

/**
 * Top level case 1:
 * Both corner and edge are on the DOWN face.
 */
class Case1Solver extends F2LCaseBaseSolver {
	/**
	 * 10 Cases:
	 * 1) Pair is matched.
	 * 2) Pair is separated.
	 *
	 * ---- Group 1: Corner's white color is on DOWN face ----
	 * 3) Corner and edge share a face and colors on that face are equal.
	 * 4) Corner and edge share a face and colors on that face are not equal.
	 * 5) Corner and edge do not share a face.
	 *
	 * ---- Group 2: Corner's "other" color matches edge's "primary" color ----
	 * 6) Corner shares a face with edge.
	 * 7) Corner does not share a face with edge.
	 *
	 * ---- Group 3: Corner's "other" color doesn't match edge's "primary" color ----
	 * 8) Edge shares a face with corner's cross color's face.
	 * 9) Edge shares a face with corner's other color's face.
	 * 10) Corner does not share a face with edge.
	 *
	 * TODO: refactor
	 */
	_getCaseNumber({ corner, edge }) {
		if (this.isPairMatched({ corner, edge })) {
			return 1;
		}
		if (this.isPairSeparated({ corner, edge })) {
			return 2;
		}

		let sharedFace;
		edge.faces().forEach(face => {
			if (corner.faces().includes(face) && face !== 'down') {
				sharedFace = face;
			}
		});
		let otherColor = corner.colors().find(color => {
			return color !== 'u' && color !== corner.getColorOfFace('down');
		});
		let primaryColor = edge.colors().find(c => edge.getFaceOfColor(c) !== 'down');

		// Group 1
		if (corner.getFaceOfColor('u') === 'down') {
			if (sharedFace) {
				if (corner.getColorOfFace(sharedFace) === edge.getColorOfFace(sharedFace)) {
					return 3;
				} else {
					return 4;
				}
			} else {
				return 5;
			}
		}

		// Group 2
		if (otherColor === primaryColor) {
			if (sharedFace) {
				return 6;
			} else {
				return 7;
			}
		}

		// Group 3
		if (sharedFace) {
			if (sharedFace === corner.getFaceOfColor('u')) {
				return 8;
			} else {
				return 9;
			}
		} else {
			return 10;
		}
	}

	_solveCase1({ corner, edge }) {
		return this.solveMatchedPair({ corner, edge });
	}

	_solveCase2({ corner, edge }) {
		return this.solveSeparatedPair({ corner, edge });
	}

	_solveCase3({ corner, edge }) {
		// calculate which side the corner is on, the position, etc.
		let currentFace = edge.faces().find(face => face !== 'down');
		let targetFace = getFaceOfMove(edge.getColorOfFace('down'));
		let prepFace = getFaceFromDirection(targetFace, 'back', { up: 'down' });
		let otherFace = corner.getFaceOfColor(edge.getColorOfFace('down'));
		let isLeft = getFaceFromDirection(currentFace, otherFace, { up: 'down' }) === 'left';

		// the moves
		let prep = getRotationFromTo('down', currentFace, prepFace);
		let moveFace = getFaceOfMove(edge.getColorOfFace(currentFace));
		let dir = isLeft ? 'D' : 'DPrime';

		moveFace = isLeft ? moveFace : R(moveFace);

		let solveMoves = `${prep} ${moveFace} ${moveFace} D D `;
		solveMoves += `${moveFace} ${dir} ${R(moveFace)} ${dir} ${moveFace} ${moveFace}`;
		this.move(solveMoves, { upperCase: true });
	}

	_solveCase4({ corner, edge }) {
		// calculate which side the corner is on, the position, etc.
		let currentFace = edge.faces().find(face => face !== 'down');
		let targetFace = getFaceOfMove(edge.getColorOfFace(currentFace));
		let otherFace = corner.faces().find(face => !edge.faces().includes(face));
		let isLeft = getFaceFromDirection(otherFace, currentFace, { up: 'down' }) === 'left';

		// the moves
		let prep = getRotationFromTo('down', currentFace, targetFace);
		let moveFace = getMoveOfFace(targetFace);
		moveFace = isLeft ? R(moveFace) : moveFace;

		this.move(`${prep} ${moveFace} D D ${R(moveFace)}`, { upperCase: true });
		this.solveSeparatedPair({ corner, edge });
	}

	_solveCase5({ corner, edge }) {
		let primary = edge.colors().find(color => edge.getFaceOfColor(color) !== 'down');
		let secondary = edge.colors().find(color => edge.getFaceOfColor(color) === 'down');

		let isLeft = getFaceFromDirection(
			getFaceOfMove(primary),
			getFaceOfMove(secondary),
			{ up: 'down' }
		) === 'right';

		let edgeCurrent = edge.getFaceOfColor(primary);
		let edgeTarget = getFaceOfMove(primary);

		// do the prep move now. need to calculate things after this move is done
		let edgePrep = getRotationFromTo('down', edgeCurrent, edgeTarget);
		this.move(edgePrep, { upperCase: true });

		// calculate corner stuff
		let cornerCurrent = corner.getFaceOfColor(primary);
		let cornerTarget = edgeTarget;

		// the moves
		let cornerPrep = getRotationFromTo('down', cornerCurrent, cornerTarget);
		let open = isLeft ? R(edgeTarget) : edgeTarget;

		this.move(`${open} ${cornerPrep} ${R(open)}`, { upperCase: true });
		this.solveMatchedPair({ corner, edge });
	}

	_solveCase6({ corner, edge }) {
		let primary = edge.colors().find(color => edge.getFaceOfColor(color) !== 'down');

		let currentFace = edge.getFaceOfColor(primary);
		let targetFace = getFaceOfMove(edge.getColorOfFace('down'));
		let isLeft = getDirectionFromFaces(
			currentFace,
			corner.getFaceOfColor(primary),
			{ up: 'down' }
		) === 'left';

		let prep = getRotationFromTo('down', currentFace, targetFace);
		let moveFace = isLeft ? targetFace : R(targetFace);
		let dir = isLeft ? 'DPrime' : 'D';

		this.move(`${prep} ${moveFace} ${dir} ${R(moveFace)}`, { upperCase: true });
		this.solveSeparatedPair({ corner, edge});
	}

	_solveCase7({ corner, edge }) {
		let primary = edge.colors().find(c => edge.getFaceOfColor(c) !== 'down');
		let cornerCurrent = corner.getFaceOfColor('u');
		let cornerTarget = getFaceOfMove(primary);
		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor(primary),
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';

		let cornerPrep = getRotationFromTo('down', cornerCurrent, cornerTarget);
		this.move(cornerPrep, { upperCase: true });

		let edgeCurrent = edge.getFaceOfColor(primary);
		let edgeTarget = corner.getFaceOfColor(primary);

		let open = isLeft ? corner.getFaceOfColor('u') : R(corner.getFaceOfColor('u'));
		let edgeMatch = getRotationFromTo('down', edgeCurrent, edgeTarget);
		this.move(`${open} ${edgeMatch} ${R(open)}`, { upperCase: true });

		this.solveMatchedPair({ corner, edge });
	}

	_solveCase8({ corner, edge }) {
		let primary = edge.colors().find(c => edge.getFaceOfColor(c) !== 'down');
		let secondary = edge.colors().find(c => edge.getFaceOfColor(c) === 'down');

		let currentFace = corner.getFaceOfColor(secondary);
		let targetFace = getFaceOfMove(primary);

		let isLeft = getDirectionFromFaces(
			currentFace,
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';

		let prep = getRotationFromTo('down', currentFace, targetFace);
		let open = isLeft ? R(targetFace) : targetFace;
		let dir = isLeft ? 'D' : 'DPrime';

		this.move(`${prep} ${open} ${dir} ${R(open)}`, { upperCase: true });
		this.solveSeparatedPair({ corner, edge });
	}

	_solveCase9({ corner, edge }) {
		let otherColor = edge.colors().find(c => edge.getFaceOfColor(c) === 'down');
		let currentFace = corner.getFaceOfColor('u');
		let targetFace = getFaceOfMove(otherColor);

		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor(otherColor),
			currentFace,
			{ up: 'down' }
		) === 'left';

		let prep = getRotationFromTo('down', currentFace, targetFace);
		let moveFace = isLeft ? targetFace : R(targetFace);

		this.move(`${prep} ${moveFace} D D ${R(moveFace)}`, { upperCase: true });
		this.solveSeparatedPair({ corner, edge });
	}

	_solveCase10({ corner, edge }) {
		let primary = edge.colors().find(c => edge.getFaceOfColor(c) !== 'down');
		let secondary = edge.colors().find(c => edge.getFaceOfColor(c) === 'down');
		let cornerCurrent = corner.getFaceOfColor('u');
		let cornerTarget = getFaceOfMove(secondary);
		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor(secondary),
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';

		let cornerPrep = getRotationFromTo('down', cornerCurrent, cornerTarget);
		this.move(cornerPrep, { upperCase: true });

		let edgeCurrent = edge.getFaceOfColor(primary);
		let edgeTarget = getFaceOfMove(primary);

		let open = isLeft ? cornerTarget : R(cornerTarget);
		let edgePrep = getRotationFromTo('down', edgeCurrent, edgeTarget);

		this.move(`${open} ${edgePrep} ${R(open)}`, { upperCase: true });
		this.solveSeparatedPair({ corner, edge });
	}
}
module.exports["Case1Solver"] = Case1Solver;

module.exports["Case1Solver"] = Case1Solver;
},
"src/solvers/f2l/cases/case-2.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { F2LCaseBaseSolver } = require("src/solvers/f2l/cases/F2LCaseBaseSolver.js");
const { getDirectionFromFaces, getRotationFromTo, getFaceOfMove } = require("src/utils/index.js");

const R = (moves) => RubiksCube.reverseMoves(moves);

/**
 * Top level case 2:
 * Corner is on the DOWN face and edge is not on DOWN or UP face.
 */
class Case2Solver extends F2LCaseBaseSolver {
	/**
	 * 4 cases:
	 *
	 * ---- Group 1: Corner's white color is on DOWN face ----
	 * 1) Pair can be matched up.
	 * 2) Pair cannot be matched up.
	 *
	 * ---- Group 2: Corner's white color is not on DOWN face ----
	 * 3) Corner's other color can match up with the edge color on that face.
	 * 4) Corner's other color cannot match up with the edge color on that face.
	 */
	_getCaseNumber({ corner, edge }) {
		// get relative right faces of corner and edge
		let cFaces = corner.faces().filter(face => face !== 'down');
		let eFaces = edge.faces();
		let cornerDir = getDirectionFromFaces(cFaces[0], cFaces[1], { up: 'down' });
		let edgeDir = getDirectionFromFaces(eFaces[0], eFaces[1], { up: 'down' });
		let cornerRight = cornerDir === 'right' ? cFaces[1] : cFaces[0];
		let edgeRight = edgeDir === 'right' ? eFaces[1] : eFaces[0];

		if (corner.getFaceOfColor('u') === 'down') {
			if (corner.getColorOfFace(cornerRight) === edge.getColorOfFace(edgeRight)) {
				return 1;
			} else {
				return 2;
			}
		}

		let otherColor = corner.colors().find(color => {
			return color !== 'u' && color !== corner.getColorOfFace('down');
		});
		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor(otherColor),
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';
		let matchingEdgeColor = isLeft ?
			edge.getColorOfFace(edgeRight) :
			edge.colors().find(c => edge.getFaceOfColor(c) !== edgeRight);

		if (otherColor === matchingEdgeColor) {
			return 3;
		} else {
			return 4;
		}
	}

	_solveCase1({ corner, edge }) {
		let color = edge.colors()[0];
		let currentFace = corner.getFaceOfColor(color);
		let targetFace = edge.getFaceOfColor(color);

		let prep = getRotationFromTo('down', currentFace, targetFace);
		this.move(prep, { upperCase: true });

		let [face1, face2] = edge.faces();
		let dir = getDirectionFromFaces(face1 , face2, { up: 'down' });
		let rightFace = dir === 'right' ? face2 : face1;

		this.move(`${rightFace} DPrime ${R(rightFace)}`, { upperCase: true });
		this.solveMatchedPair({ corner, edge });
	}

	_solveCase2({ corner, edge }) {
		let currentFace = corner.getFaceOfColor(edge.colors()[0]);
		let targetFace = edge.getFaceOfColor(edge.colors()[1]);

		let prep = getRotationFromTo('down', currentFace, targetFace);
		this.move(prep, { upperCase: true });

		let dir = getDirectionFromFaces(edge.faces()[0], edge.faces()[1], { up: 'down' });
		let rightFace = edge.faces()[dir === 'right' ? 1 : 0];

		this.move(`${rightFace} D ${R(rightFace)} DPrime`, { upperCase: true });
		this.move(`${rightFace} D ${R(rightFace)}`, { upperCase: true });

		this.solveSeparatedPair({ corner, edge });
	}

	_solveCase3({ corner, edge }) {
		this._case3And4Helper({ corner, edge }, 3);
	}

	_solveCase4({ corner, edge }) {
		this._case3And4Helper({ corner, edge }, 4);
	}

	_case3And4Helper({ corner, edge }, caseNum) {
		let downColor = corner.getColorOfFace('down');
		let otherColor = corner.colors().find(c => ![downColor, 'u'].includes(c));
		let matchingColor = caseNum === 3 ? otherColor : downColor;
		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor(otherColor),
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';

		let currentFace = corner.getFaceOfColor('u');
		// let targetFace = getFaceOfMove(otherColor)
		let targetFace = edge.getFaceOfColor(matchingColor);

		let prep = getRotationFromTo('down', currentFace, targetFace);
		let moveFace = isLeft ? targetFace : R(targetFace);
		let dir = isLeft ? 'DPrime' : 'D';
		dir = caseNum === 4 ? R(dir) : dir;

		this.move(`${prep} ${moveFace} ${dir} ${R(moveFace)}`, { upperCase: true });

		let method = `solve${caseNum === 3 ? 'Matched' : 'Separated'}Pair`;
		this[method]({ corner, edge });
	}
}
module.exports["Case2Solver"] = Case2Solver;

module.exports["Case2Solver"] = Case2Solver;
},
"src/solvers/f2l/cases/case-3.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { F2LCaseBaseSolver } = require("src/solvers/f2l/cases/F2LCaseBaseSolver.js");
const { getDirectionFromFaces, getFaceFromDirection, getRotationFromTo } = require("src/utils/index.js");

const R = (moves) => RubiksCube.reverseMoves(moves);

/**
 * Top level case 3:
 * Corner is on UP face and edge is on DOWN face.
 */
class Case3Solver extends F2LCaseBaseSolver {
	/**
   * 2 cases:
   *
   * 1) Corner's cross color is on the cross face.
   * 2) Corner's cross color is not on the cross face.
   */
	_getCaseNumber({ corner, edge }) {
		if (corner.getColorOfFace('up') === 'u') {
			return 1;
		} else {
			return 2;
		}
	}

	_solveCase1({ corner, edge }) {
		let faces = corner.faces().filter(face => face !== 'up');
		let direction = getDirectionFromFaces(faces[0], faces[1], { up: 'down' });
		let [leftFace, rightFace] = direction === 'right' ? faces : faces.reverse();

		let currentFace = edge.faces().find(face => face !== 'down');
		let primaryColor = edge.getColorOfFace(currentFace);

		let targetFace = getFaceFromDirection(
			corner.getFaceOfColor(primaryColor),
			primaryColor === corner.getColorOfFace(rightFace) ? 'right' : 'left',
			{ up: 'down' }
		);
		let isLeft = primaryColor === corner.getColorOfFace(leftFace);

		let prep = getRotationFromTo('down', currentFace, targetFace);
		let moveFace = isLeft ? rightFace : R(leftFace);
		let dir = isLeft ? 'DPrime' : 'D';

		this.move(`${prep} ${moveFace} ${dir} ${R(moveFace)}`, { upperCase: true });
		this.solveMatchedPair({ corner, edge });
	}

	_solveCase2({ corner, edge }) {
		let otherColor = corner.colors().find(color => {
			return color !== 'u' && corner.getFaceOfColor(color) !== 'up';
		});
		let currentFace = edge.faces().find(face => face !== 'down');
		let primaryColor = edge.getColorOfFace(currentFace);

		let willBeMatched = otherColor !== primaryColor;
		let targetFace = corner.getFaceOfColor(willBeMatched ? otherColor : 'u');

		let prep = getRotationFromTo('down', currentFace, targetFace);
		let isLeft = getDirectionFromFaces(
			corner.getFaceOfColor(otherColor),
			corner.getFaceOfColor('u'),
			{ up: 'down' }
		) === 'left';
		let dir = isLeft ? 'DPrime' : 'D';
		let moveFace = corner.getFaceOfColor('u');
		moveFace = isLeft ? R(moveFace) : moveFace;

		this.move(`${prep} ${moveFace} ${dir} ${R(moveFace)}`, { upperCase: true });
		let solveFn = `solve${willBeMatched ? 'Matched' : 'Separated'}Pair`;
		this[solveFn]({ corner, edge });
	}
}
module.exports["Case3Solver"] = Case3Solver;

module.exports["Case3Solver"] = Case3Solver;
},
"src/solvers/f2l/index.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { F2LBaseSolver } = require("src/solvers/f2l/F2LBaseSolver.js");
const { Case1Solver } = require("src/solvers/f2l/cases/case-1.js");
const { Case2Solver } = require("src/solvers/f2l/cases/case-2.js");
const { Case3Solver } = require("src/solvers/f2l/cases/case-3.js");
const { getDirectionFromFaces } = require("src/utils/index.js");

const R = (moves) => RubiksCube.reverseMoves(moves);

class F2LSolver extends F2LBaseSolver {
	constructor(...args) {
		super(...args);

		this.subCaseOptions = Object.assign(this.options, {
			_overrideAfterEach: true
		});
	}

	solve() {
		this.partitions = [];

		let pairs = this.getAllPairs();
		pairs.forEach(({ corner, edge }) => {
			let partition = this._solve({ corner, edge });
			this.partitions.push(partition);
		});

		return this.partitions;
	}

	isSolved() {
		let pairs = this.getAllPairs();
		for (let pair of pairs) {
			if (!this.isPairSolved(pair)) {
				return false;
			}
		}

		return true;
	}

	getAllPairs() {
		let corners = this.cube.corners().filter(corner => {
			return corner.hasColor('u');
		});
		let edges = this.cube.edges().filter(edge => {
			return !edge.hasColor('u') && !edge.hasColor('d');
		});

		let pairs = [];

		for (let edge of edges) {
			let corner = corners.find(corner => {
				let colors = edge.colors();
				return corner.hasColor(colors[0]) && corner.hasColor(colors[1]);
			});

			pairs.push({ edge, corner });
		}

		return pairs;
	}

	/**
	 * 4 top level cases: (cross face is UP)
	 *
	 * 1) Corner and edge are both on the DOWN face.
	 * 2) Corner is on the DOWN face and edge is not on DOWN face.
	 * 3) Corner is on UP face and edge is on DOWN face.
	 * 4) Corner is on UP face and edge is not on DOWN face.
	 */
	_getCaseNumber({ corner, edge }) {
		if (corner.faces().includes('down')) {
			if (edge.faces().includes('down')) {
				return 1;
			}
			if (!edge.faces().includes('down') && !edge.faces().includes('up')) {
				return 2;
			}
		}

		if (corner.faces().includes('up')) {
			if (edge.faces().includes('down')) {
				return 3;
			}
			if (!edge.faces().includes('down') && !edge.faces().includes('up')) {
				return 4;
			}
		}

		throw new Error('Could not find a top level F2L case');
	}

	_solveCase1({ corner, edge }) {
		let solver = new Case1Solver(this.cube, this.subCaseOptions);
		let partition = solver.solve({ corner, edge });

		this.totalMoves = partition.moves;
		this.partition.caseNumber = [this.partition.caseNumber, partition.caseNumber];
	}

	_solveCase2({ corner, edge }) {
		let solver = new Case2Solver(this.cube, this.subCaseOptions);
		let partition = solver.solve({ corner, edge });

		this.totalMoves = partition.moves;
		this.partition.caseNumber = [this.partition.caseNumber, partition.caseNumber];
	}

	_solveCase3({ corner, edge }) {
		let solver = new Case3Solver(this.cube, this.subCaseOptions);
		let partition = solver.solve({ corner, edge });

		this.totalMoves = partition.moves;
		this.partition.caseNumber = [this.partition.caseNumber, partition.caseNumber];
	}

	_solveCase4({ corner, edge }) {
		if (this.isPairSolved({ corner, edge })) {
			return;
		}

		let solver;
		if (corner.faces().includes(edge.faces()[0]) &&
				corner.faces().includes(edge.faces()[1])) {
			solver = new Case1Solver(this.cube, this.subCaseOptions);
		} else {
			solver = new Case2Solver(this.cube, this.subCaseOptions);
		}

		let faces = corner.faces().filter(face => face !== 'up');
		let dir = getDirectionFromFaces(faces[0], faces[1], { up: 'down' });
		let cornerRightFace = dir === 'right' ? faces[1] : faces[0];

		this.move(`${cornerRightFace} D ${R(cornerRightFace)}`, { upperCase: true });

		let partition = solver.solve({ corner, edge });

		this.partition.caseNumber = [this.partition.caseNumber, partition.caseNumber];
		this.totalMoves = [...this.totalMoves, ...partition.moves];
	}
}
module.exports["F2LSolver"] = F2LSolver;

module.exports["F2LSolver"] = F2LSolver;
},
"src/solvers/oll/index.js":function(require,module,exports){
const { RubiksCube } = require("src/models/RubiksCube.js");
const { BaseSolver } = require("src/solvers/BaseSolver.js");
const { getDirectionFromFaces } = require("src/utils/index.js");

const SOLVED_STATE = '00000000';
const R = (moves) => RubiksCube.reverseMoves(moves);

class OLLSolver extends BaseSolver {
	constructor(...args) {
		super(...args);
		this.phase = 'oll';

		// orientations in order based on http://badmephisto.com/oll.php, however the
		// actual algorithms may be different.
		this.algorithms = {
			[SOLVED_STATE]: '', // solved state
			'21000110': 'F R U RPrime UPrime FPrime', // 1
			'21211010': 'F R U RPrime UPrime FPrime F R U RPrime UPrime FPrime', // 2
			'10201020': 'R U2 RPrime UPrime R U RPrime UPrime R UPrime RPrime', // 3
			'01112000': 'F U R UPrime RPrime FPrime', // 4
			'11102120': 'F U R UPrime RPrime U R UPrime RPrime FPrime', // 5
			'11210000': 'RPrime UPrime FPrime U F R', // 6
			'11102021': 'FPrime LPrime UPrime L U LPrime UPrime L U F', // 7
			'10011110': 'R L2 BPrime L BPrime LPrime B2 L BPrime L RPrime', // 8
			'00202121': 'LPrime R2 B RPrime B R B2 RPrime B RPrime L', // 9
			'01111111': 'F U R UPrime RPrime FPrime L F U FPrime UPrime LPrime', // 10
			'21212101': 'F U R UPrime RPrime FPrime R B U BPrime UPrime RPrime', // 11
			'21211111': 'F R U RPrime UPrime FPrime B U L UPrime LPrime BPrime', // 12
			'20201010': 'R U2 R2 UPrime R2 UPrime R2 U2 R', // 13
			'01101110': 'R B RPrime L U LPrime UPrime R BPrime RPrime', // 14
			'21002120': 'LPrime BPrime L RPrime UPrime R U LPrime B L', // 15
			'21001100': 'RPrime F R U RPrime UPrime FPrime U R', // 16
			'01000100': 'R U RPrime UPrime MPrime U R UPrime rPrime', // 17
			'01010101': 'M U R U RPrime UPrime M2 U R UPrime rPrime', // 18
			'10211021': 'F R U RPrime UPrime R U RPrime UPrime FPrime B U L UPrime LPrime BPrime', // 19
			'11000120': 'R U RPrime UPrime RPrime F R FPrime', // 20
			'10000020': 'LPrime BPrime R B L BPrime RPrime B', // 21
			'20001000': 'B LPrime BPrime R B L BPrime RPrime', // 22
			'00112001': 'RPrime UPrime RPrime F R FPrime U R', // 23
			'21112111': 'R U2 RPrime RPrime F R FPrime U2 RPrime F R FPrime', // 24
			'10002101': 'R U2 RPrime RPrime F R FPrime R U2 RPrime', // 25
			'21110101': 'M U R U RPrime UPrime MPrime RPrime F R FPrime', // 26
			'11212010': 'F LPrime U2 L U2 L F2 LPrime F', // 27
			'01110020': 'R U RPrime U R UPrime RPrime UPrime RPrime F R FPrime', // 28
			'10012100': 'RPrime UPrime R UPrime RPrime U R U R BPrime RPrime B', // 29
			'10112021': 'RPrime UPrime R UPrime RPrime U FPrime U F R', // 30
			'01110121': 'F U R UPrime RPrime FPrime F U FPrime UPrime FPrime L F LPrime', // 31
			'01112101': 'F U R UPrime RPrime FPrime B U BPrime UPrime SPrime U B UPrime bPrime', // 32
			'21212000': 'lPrime U2 L U LPrime U l', // 33
			'01212020': 'r U RPrime U R U2 rPrime', // 34
			'00202020': 'R U RPrime U R U2 RPrime', // 35
			'10101000': 'RPrime UPrime R URprime RPrime U2 R', // 36
			'01001021': 'RPrime U R U2 RPrime UPrime FPrime U F U R', // 37
			'10200101': 'R UPrime RPrime U2 R U B UPrime BPrime UPrime RPrime', // 38
			'21102011': 'r U RPrime U R UPrime RPrime U R U2 rPrime', // 39
			'21112010': 'lPrime UPrime L UPrime LPrime U L UPrime LPrime U2 l', // 40
			'11100011': 'r U2 RPrime UPrime R UPrime rPrime', // 41
			'11012000': 'F R UPrime RPrime UPrime R U RPrime FPrime', // 42
			'11001011': 'lPrime UPrime L UPrime LPrime U2 l', // 43
			'01010000': 'r U RPrime UPrime M U R UPrime RPrime', // 44
			'01002110': 'R U RPrime UPrime BPrime RPrime F R FPrime B', // 45
			'01202120': 'L FPrime LPrime UPrime L F LPrime FPrime U F', // 46
			'11001110': 'RPrime F R U RPrime FPrime R F UPrime FPrime', // 47
			'10200000': 'R2 D RPrime U2 R DPrime RPrime U2 RPrime', // 48
			'20112011': 'RPrime U2 R2 U RPrime U R U2 BPrime RPrime B', // 49
			'10000121': 'R U BPrime UPrime RPrime U R B RPrime', // 50
			'11000021': 'RPrime UPrime F U R UPrime RPrime FPrime R', // 51
			'01100120': 'L FPrime LPrime UPrime L U F UPrime LPrime', // 52
			'11112020': 'RPrime F R2 FPrime U2 FPrime U2 F RPrime', // 53
			'20110100': 'BPrime RPrime B LPrime BPrime R R BPrime RPrime B2 L', // 54
			'20100101': 'B L BPrime R B L2 B L B2 RPrime', // 55
			'01101011': 'FPrime UPrime F L FPrime LPrime U L F LPrime', // 56
			'21012020': 'F U FPrime RPrime F R UPrime RPrime FPrime R', // 57
		};
	}

	isSolved() {
		return this.getOllString() === SOLVED_STATE;
	}

	solve() {
		return this._solve();
	}

	_getCaseNumber() {
		return this.getOllString();
	}

	_solveCase(ollString) {
		let pattern = this.findPattern(ollString);
		let algorithm = this.getAlgorithm(pattern);
		let frontFace = this._getFrontFace(ollString, pattern);

		this.move(algorithm, {
			orientation: { up: 'down', front: frontFace }
		});
	}

	getOllString() {
		let orientations = [];

		let cubies = this._getOllCubies();
		cubies.forEach(cubie => {
			let orientation = this._getCubieOrientation(cubie);
			orientations.push(orientation);
		});

		return orientations.join('');
	}

	/**
	 * @param {string} [ollString] - Probably unnecessary. If passed in, it saves
	 * a step computing the ollString.
	 */
	findPattern(ollString) {
		if (typeof ollString === 'undefined') {
			ollString = this.getOllString();
		}

		for (let i = 0; i < 4; i++) {
			let algorithm = this.algorithms[ollString];

			if (typeof algorithm === 'string') {
				return ollString;
			} else {
				ollString = this._rotateOllStringLeft(ollString);
			}
		}

		throw new Error(`No pattern found for oll string "${ollString}"`);
	}

	/**
	 * @param {string} [pattern] - The pattern on this OLL or the ollString.
	 */
	getAlgorithm(pattern) {
		if (typeof pattern === 'undefined') {
			pattern = this.getPattern(pattern); // pattern can be an ollString
		}

		if (typeof this.algorithms[pattern] === 'undefined') {
			throw new Error(`No algorithm found for pattern "${pattern}"`);
		}

		return this.algorithms[pattern];
	}

	_getOllCubies() {
		let positions = [
			['front', 'down', 'right'],
			['front', 'down'],
			['front', 'down', 'left'],
			['left', 'down'],
			['left', 'down', 'back'],
			['back', 'down'],
			['back', 'down', 'right'],
			['right', 'down']
		];

		return positions.map(pos => this.cube.getCubie(pos));
	}

	/**
	 * Returns a number indicating the orientation of the cubie.
	 * 0 --> The DOWN color is on the DOWN face.
	 * 1 --> The DOWN color is a clockwise rotation from "solved".
	 * 2 --> The DOWN color is a counter-clockwise rotation from "solved".
	 */
	_getCubieOrientation(cubie) {
		if (cubie.getColorOfFace('down') === 'd') {
			return 0;
		}

		// if cubie is an edge piece, return 1
		if (cubie.isEdge()) {
			return 1;
		}

		let [face1, face2] = cubie.faces().filter(face => face !== 'down');
		let dir = getDirectionFromFaces(face1, face2, { up: 'down' });
		let rightFace = dir === 'right' ? face2 : face1;

		return cubie.getColorOfFace(rightFace) === 'd' ? 1 : 2;
	}

	_getFrontFace(ollString, pattern) {
		let rotationOrder = ['front', 'left', 'back', 'right'];

		for (let i = 0; i < 4; i++) {
			if (ollString === pattern) {
				return rotationOrder[i];
			} else {
				ollString = this._rotateOllStringLeft(ollString);
			}
		}

		throw new Error(`OLL string "${ollString}" does not resolve to the pattern "${pattern}"`);
	}

	_rotateOllStringLeft(ollString) {
		return ollString.slice(2) + ollString.slice(0, 2);
	}

	_getPartitionBefore() {
		return this.getOllString();
	}

	_getPartitionAfter() {
		return null;
	}
}
module.exports["OLLSolver"] = OLLSolver;

module.exports["OLLSolver"] = OLLSolver;
},
"src/solvers/pll/index.js":function(require,module,exports){
const { BaseSolver } = require("src/solvers/BaseSolver.js");
const { getFaceOfMove, getRotationFromTo, getDirectionFromFaces } = require("src/utils/index.js");

const SOLVED_STATE = '0 0 0 0 0 0 0 0';

class PLLSolver extends BaseSolver {
	constructor(...args) {
		super(...args);
		this.phase = 'pll';

		// permutations in order based on http://badmephisto.com/pll.php, however
		// the actual algorithms may be different.
		this.algorithms = {
			[SOLVED_STATE]: '', // already solved
			'2 -1 1 -1 1 0 0 2': 'R2 F2 RPrime BPrime R F2 RPrime B RPrime', // #1
			'-1 1 -1 2 2 0 0 1': 'R BPrime R F2 RPrime B R F2 R2', // #2
			'1 -1 2 2 0 0 1 -1': 'R UPrime R U R U R UPrime RPrime UPrime R2', // #3
			'-1 1 -1 1 0 0 2 2': 'R2 U R U RPrime UPrime RPrime UPrime RPrime U RPrime', // #4
			'2 2 2 2 2 2 2 2': 'M M U M M U2 M M U M M', // #5
			'0 1 1 1 1 0 2 2': 'R U RPrime UPrime RPrime F R2 UPrime RPrime UPrime R U RPrime FPrime', // #6
			'1 0 2 0 1 0 0 0': 'R U2 RPrime UPrime R U2 LPrime U RPrime UPrime L', // #7
			'0 2 2 0 1 1 1 1': 'F R UPrime RPrime UPrime R U RPrime FPrime R U RPrime UPrime RPrime F R FPrime', // #8
			'1 -1 -1 2 -1 -1 1 0': 'RPrime U2 R U2 RPrime F R U RPrime UPrime RPrime FPrime R2', // #9
			'0 1 -1 -1 2 -1 -1 1': 'R UPrime RPrime UPrime R U R D RPrime UPrime R DPrime RPrime U2 RPrime', // #10
			'0 2 -1 -1 -1 -1 2 0': 'RPrime U RPrime UPrime BPrime D BPrime DPrime B2 RPrime BPrime R B R', // #11
			'2 -1 -1 -1 -1 2 0 0': 'RPrime UPrime FPrime R U RPrime UPrime RPrime F R2 UPrime RPrime UPrime R U RPrime U R', // #12
			'-1 2 2 2 -1 2 0 2': 'L U LPrime B2 uPrime B UPrime BPrime U BPrime u B2', // #13
			'2 -1 2 0 2 -1 2 2': 'RPrime UPrime R B2 u BPrime U B UPrime B uPrime B2', // #14
			'2 -1 1 1 0 1 1 -1': 'R2 uPrime R UPrime R U RPrime u R2 B UPrime BPrime', // #15
			'1 0 1 1 -1 2 -1 1': 'R2 u RPrime U RPrime UPrime R uPrime R2 FPrime U F', // #16
			'1 -1 -1 1 1 -1 -1 1': 'U RPrime UPrime R UPrime R U R UPrime RPrime U R U R2 UPrime RPrime', // #17
			'0 1 0 0 0 1 0 2': 'LPrime U2 L U LPrime U2 R UPrime L U RPrime', // #18
			'1 1 -1 -1 1 1 -1 -1': 'R BPrime RPrime F R B RPrime FPrime R B RPrime F R BPrime RPrime FPrime', // #19
			'2 0 2 0 2 0 2 0': 'R U RPrime U R U RPrime FPrime R U RPrime UPrime RPrime F R2 UPrime RPrime U2 R UPrime RPrime', // #20
			'0 2 0 2 0 2 0 2': 'RPrime U R UPrime RPrime FPrime UPrime F R U RPrime F RPrime FPrime R UPrime R', // #21
		};
	}

	solve() {
		return this._solve();
	}

	_getCaseNumber() {
		return this.getPllString();
	}

	_solveCase(pllString) {
		let pattern = this.findPattern(pllString);
		let algorithm = this.getAlgorithm(pattern);
		let frontFace = this._getFrontFace(pllString, pattern);

		this.move(algorithm, {
			orientation: { up: 'down', front: frontFace }
		});

		// may need an extra rotation of DOWN for a complete solve
		let cubie = this.cube.getCubie(['down', 'front']); // any cubie on DOWN
		let origin = 'front';
		let target = getFaceOfMove(cubie.getColorOfFace(origin));
		let lastLayerMove = getRotationFromTo('down', origin, target);

		this.move(lastLayerMove);
	}

	isSolved() {
		return this.cube.isSolved();
	}

	/**
	 * Permutations are unique in the way that each cubie is permutated relative
	 * to the one adjacent to it. For each cubie (in order), find the relative
	 * direction from its color to the next cubie's color, and turn it into a
	 * number. This will allow each permutation to be held in a unique string.
	 */
	getPllString() {
		let pllString = [];
		let pllCubies = this._getPllCubies();

		let faces = ['front', 'left', 'back', 'right']; // we're upside down

		for (let i = 0; i < pllCubies.length; i++) {
			let cubie1 = pllCubies[i];
			let cubie2 = pllCubies[i + 1];
			let faceToCheck = faces[~~(i / 2)];

			// get the colors of the two cubies
			let color1 = cubie1.getColorOfFace(faceToCheck);

			// wrap around to the first cubie
			if (!cubie2) {
				cubie2 = pllCubies[0];
			}
			let color2 = cubie2.getColorOfFace(faceToCheck);

			// find the direction between the two
			let face1 = getFaceOfMove(color1);
			let face2 = getFaceOfMove(color2);

			// turn it into a number
			let direction = getDirectionFromFaces(face1, face2, { up: 'down' });
			if (direction === 'front') direction = 0;
			if (direction === 'right') direction = 1;
			if (direction === 'left') direction = -1;
			if (direction === 'back') direction = 2;

			pllString.push(direction);
		}

		return pllString.join(' ');
	}

	findPattern(pllString) {
		let initialString = pllString;

		if (typeof pllString === 'undefined') {
			pllString = this.getPllString();
		}

		for (let i = 0; i < 4; i++) {
			let algorithm = this.algorithms[pllString];

			if (typeof algorithm === 'string') {
				return pllString;
			} else {
				pllString = this._rotatePllStringLeft(pllString);
			}
		}

		throw new Error(`No pattern found for pll string "${initialString}"`);
	}

	getAlgorithm(pattern) {
		if (typeof pattern === 'undefined') {
			pattern = this.findPattern(pattern); // pattern can be a pllString
		}

		if (typeof this.algorithms[pattern] === 'undefined') {
			throw new Error(`No algorithm found for pattern "${pattern}"`);
		}

		return this.algorithms[pattern];
	}

	_getPllCubies() {
		let positions = [
			['front', 'down', 'right'],
			['front', 'down'],
			['front', 'down', 'left'],
			['left', 'down'],
			['left', 'down', 'back'],
			['back', 'down'],
			['back', 'down', 'right'],
			['right', 'down']
		];

		return positions.map(pos => this.cube.getCubie(pos));
	}

	_getCubiePermutation(cubie) {
		// pick a face, any face (expect for the down face)
		let face = cubie.faces().find(face => face !== 'down');

		// get the cube face this face lies on
		let cubeFace = getFaceOfMove(cubie.getColorOfFace(face));

		// find the move that will permute the cubie correctly
		let moveToSolveCubie = getRotationFromTo('down', face, cubeFace);
		moveToSolveCubie = moveToSolveCubie.toLowerCase();

		// translate the move to a number
		let dir;
		if (moveToSolveCubie === '') dir = 0;
		else if (moveToSolveCubie.includes('prime')) dir = 1;
		else if (moveToSolveCubie.split(' ').length > 1) dir = 2;
		else dir = -1;

		return dir;
	}

	_rotatePllStringLeft(pllString) {
		let arr = pllString.split(' ').map(num => parseInt(num));
		return [...arr.slice(2), ...arr.slice(0, 2)].join(' ');
	}

	_getFrontFace(pllString, pattern) {
		let rotationOrder = ['front', 'left', 'back', 'right'];

		for (let i = 0; i < 4; i++) {
			if (pllString === pattern) {
				return rotationOrder[i];
			} else {
				pllString = this._rotatePllStringLeft(pllString);
			}
		}

		throw new Error(`OLL string "${pllString}" does not resolve to the pattern "${pattern}"`);
	}
}
module.exports["PLLSolver"] = PLLSolver;

module.exports["PLLSolver"] = PLLSolver;
},
"src/utils/index.js":function(require,module,exports){
const cross = require("deps/gl-vec3/cross.js").default;
const { Face } = require("src/models/Face.js");
const { Vector } = require("src/models/Vector.js");

// maps each face with the notation for their middle moves
const _middlesMatchingFace = {
	f: 's',
	r: 'mprime',
	u: 'eprime',
	d: 'e',
	l: 'm',
	b: 'sprime'
};

/**
 * @param {string} move - The notation of a move, e.g. rPrime.
 * @return {string}
 */
const getFaceOfMove = (move) => {
	if (typeof move !== 'string') {
		throw new TypeError('move must be a string');
	}

	let faceLetter = move[0].toLowerCase();

	if (faceLetter === 'f') return 'front';
	if (faceLetter === 'r') return 'right';
	if (faceLetter === 'u') return 'up';
	if (faceLetter === 'd') return 'down';
	if (faceLetter === 'l') return 'left';
	if (faceLetter === 'b') return 'back';
};

/**
 * Almost useless. Almost.
 * @param {string} face - The string identifying a face.
 * @return {string}
 */
const getMoveOfFace = (face) => {
	if (typeof face !== 'string') {
		throw new TypeError('face must be a string');
	}

	face = face.toLowerCase();

	if (!['front', 'right', 'up', 'down', 'left', 'back'].includes(face)) {
		throw new Error(`${face} is not valid face`);
	}

	return face[0];
};

const getMiddleMatchingFace = (face) => {
	face = face.toLowerCase()[0];
	return _middlesMatchingFace[face];
};

const getFaceMatchingMiddle = (middle) => {
	middle = middle.toLowerCase();

	for (let face of Object.keys(_middlesMatchingFace)) {
		let testMiddle = _middlesMatchingFace[face];
		if (middle === testMiddle) {
			return face;
		}
	}
};

/**
 * @param {string|array} notations - The move notation.
 * @param {object} options - Move options.
 * @prop {boolean} options.upperCase - Turn all moves to upper case (i.e. no "double" moves).
 *
 * @return {string|array} -- whichever was initially given.
 */
const transformNotations = (notations, options = {}) => {
	let normalized = normalizeNotations(notations);

	if (options.upperCase) {
		normalized = normalized.map(n => n[0].toUpperCase() + n.slice(1));
	}

	if (options.orientation) {
		normalized = orientMoves(normalized, options.orientation);
	}

	if (options.reverse) {
		normalized = _reverseNotations(normalized);
	}

	return typeof notations === 'string' ? normalized.join(' ') : normalized;
};

/**
 * @param {array|string} notations - The notations to noramlize.
 * @return {array}
 */
const normalizeNotations = (notations) => {
	if (typeof notations === 'string') {
		notations = notations.split(' ');
	}

	notations = notations.filter(notation => notation !== '');

	return notations.map(notation => {
		let isPrime = notation.toLowerCase().includes('prime');
		let isDouble = notation.includes('2');

		notation = notation[0];

		if (isDouble) notation = notation[0] + '2';
		else if (isPrime) notation = notation + 'prime';

		return notation;
	});
};

/**
 * Finds the direction from an origin face to a target face. The origin face
 * will be oriented so that it becomes FRONT. An orientation object must be
 * provided that specifies any of these faces (exclusively): TOP, RIGHT, DOWN,
 * LEFT.
 * If FRONT or BACK is provided along with one of those faces, it will be
 * ignored. If FRONT or BACK is the only face provided, the orientation is
 * ambiguous and an error will be thrown.
 *
 * Example:
 * getDirectionFromFaces('back', 'up', { down: 'right' })
 * Step 1) orient the BACK face so that it becomes FRONT.
 * Step 2) orient the DOWN face so that it becomes RIGHT.
 * Step 3) Find the direction from BACK (now FRONT) to UP (now LEFT).
 * Step 4) Returns 'left'.
 *
 * @param {string} origin - The origin face.
 * @param {string} target - The target face.
 * @param {object} orientation - The object that specifies the cube orientation.
 * @return {string|number}
 */
const getDirectionFromFaces = (origin, target, orientation) => {
	orientation = _toLowerCase(orientation);
	orientation = _prepOrientationForDirection(orientation, origin);

	let fromFace = new Face(origin);
	let toFace = new Face(target);

	let rotations = _getRotationsForOrientation(orientation);
	_rotateFacesByRotations([fromFace, toFace], rotations);

	let axis = new Vector(cross([], fromFace.normal(), toFace.normal())).getAxis();
	let direction = Vector.getAngle(fromFace.normal(), toFace.normal());

	if (axis === 'x' && direction > 0) return 'down';
	if (axis === 'x' && direction < 0) return 'up';
	if (axis === 'y' && direction > 0) return 'right';
	if (axis === 'y' && direction < 0) return 'left';

	if (direction === 0) {
		return 'front';
	} else if (direction === Math.PI) {
		return 'back';
	}
};

/**
 * See `getDirectionFromFaces`. Almost identical, but instead of finding a
 * direction from an origin face and target face, this finds a target face from
 * an origin face and direction.
 * @param {string} origin - The origin face.
 * @param {string} direction - The direction.
 * @param {object} orientation - The orientation object.
 * @return {string}
 */
const getFaceFromDirection = (origin, direction, orientation) => {
	orientation = _toLowerCase(orientation);
	orientation = _prepOrientationForDirection(orientation, origin);

	let fromFace = new Face(origin);

	let rotations = _getRotationsForOrientation(orientation);
	_rotateFacesByRotations([fromFace], rotations);

	let directionFace = new Face(direction);
	let { axis, angle } = Vector.getRotationFromNormals(fromFace.normal(), directionFace.normal());
	fromFace.rotate(axis, angle);

	// at this point fromFace is now the target face, but we still need to revert
	// the orientation to return the correct string
	let reversedRotations = rotations.map(rotation => Vector.reverseRotation(rotation)).reverse();
	_rotateFacesByRotations([fromFace], reversedRotations);
	return fromFace.toString();
};

/**
 * Finds a move that rotates the given face around its normal, by the angle
 * described by normal1 -> normal2.
 * @param {string} face - The face to rotate.
 * @param {string} from - The origin face.
 * @param {string} to - The target face.
 * @return {string}
 */
const getRotationFromTo = (face, from, to) => {
	const rotationFace = new Face(face);
	const fromFace = new Face(from);
	const toFace = new Face(to);

	let rotationAxis = rotationFace.vector.getAxis();
	let [fromAxis, toAxis] = [fromFace.vector.getAxis(), toFace.vector.getAxis()];

	if ([fromAxis.toLowerCase(), toAxis.toLowerCase()].includes(rotationAxis.toLowerCase())) {
		throw new Error(`moving ${rotationFace} from ${fromFace} to ${toFace} is not possible.`);
	}

	let move = getMoveOfFace(face).toUpperCase();
	let angle = Vector.getAngle(fromFace.normal(), toFace.normal());
	if (rotationFace.vector.getMagnitude() < 0) {
		angle *= -1;
	}

	if (angle === 0) {
		return '';
	} else if (Math.abs(angle) === Math.PI) {
		return `${move} ${move}`;
	} else if (angle < 0) {
		return `${move}`;
	} else if (angle > 0) {
		return `${move}Prime`;
	}
};

/**
 * Returns an array of transformed notations so that if done when the cube's
 * orientation is default (FRONT face is FRONT, RIGHT face is RIGHT, etc.), the
 * moves will have the same effect as performing the given notations on a cube
 * oriented by the specified orientation.
 *
 * Examples:
 * orientMoves(['R', 'U'], { front: 'front', up: 'up' })      === ['R', 'U']
 * orientMoves(['R', 'U'], { front: 'front', down: 'right' }) === ['U', 'L']
 * orientMoves(['R', 'U', 'LPrime', 'D'], { up: 'back', right: 'down' }) === ['D', 'B', 'UPrime', 'F']
 *
 * @param {array} notations - An array of notation strings.
 * @param {object} orientation - The orientation object.
 */
const orientMoves = (notations, orientation) => {
	orientation = _toLowerCase(orientation);
	let rotations = _getRotationsForOrientation(orientation);
	rotations.reverse().map(rotation => Vector.reverseRotation(rotation));

	return notations.map(notation => {
		let isPrime = notation.toLowerCase().includes('prime');
		let isDouble = notation.includes('2');
		let isWithMiddle = notation[0] === notation[0].toLowerCase();
		let isMiddle = ['m', 'e', 's'].includes(notation[0].toLowerCase());

		if (isDouble) {
			notation = notation.replace('2', '');
		}

		let face;

		if (isMiddle) {
			let faceStr = getFaceOfMove(getFaceMatchingMiddle(notation));
			face = new Face(faceStr);
		} else {
			let faceStr = getFaceOfMove(notation[0]);
			face = new Face(faceStr);
		}

		_rotateFacesByRotations([face], rotations);

		let newNotation; // this will always be lower case

		if (isMiddle) {
			newNotation = getMiddleMatchingFace(face.toString());
		} else {
			newNotation = face.toString()[0];
		}

		if (!isWithMiddle) newNotation = newNotation.toUpperCase();
		if (isDouble) newNotation = newNotation + '2';
		if (isPrime && !isMiddle) newNotation += 'prime';

		return newNotation;
	});
};

//-----------------
// Helper functions
//-----------------

/**
 * Returns an object with all keys and values lowercased. Assumes all keys and
 * values are strings.
 * @param {object} object - The object to map.
 */
function _toLowerCase(object) {
	let ret = {};
	Object.keys(object).forEach(key => {
		ret[key.toLowerCase()] = object[key].toLowerCase();
	});
	return ret;
}

/**
 * This function is specificly for `getDirectionFromFaces` and
 * `getFaceFromDirection`. It removes all keys that are either 'front' or 'back'
 * and sets the given front face to orientation.front.
 * @param {object} orientation - The orientation object.
 * @param {string} front - The face to set as front.
 */
function _prepOrientationForDirection(orientation, front) {
	let keys = Object.keys(orientation);

	if (keys.length <= 1 && ['front', 'back'].includes(keys[0])) {
		throw new Error(`Orientation object "${orientation}" is ambiguous. Please specify one of these faces: "up", "right", "down", "left"`);
	}

	// remove "front" and "back" from provided orientation object
	let temp = orientation;
	orientation = {};

	keys.forEach(key => {
		if (['front', 'back'].includes(key)) {
			return;
		}
		orientation[key] = temp[key];
	});

	orientation.front = front.toLowerCase();

	return orientation;
}

/**
 * @param {object} orientation - The orientation object.
 * @return {array}
 */
function _getRotationsForOrientation(orientation) {
	if (Object.keys(orientation) <= 1) {
		throw new Error(`Orientation object "${orientation}" is ambiguous. Please specify 2 faces.`);
	}

	let keys = Object.keys(orientation);
	let origins = keys.map(key => new Face(orientation[key]));
	let targets = keys.map(key => new Face(key));

	// perform the first rotation, and save it
	let rotation1 = Vector.getRotationFromNormals(
		origins[0].normal(),
		origins[0].orientTo(targets[0]).normal()
	);

	// perform the first rotation on the second origin face
	origins[1].rotate(rotation1.axis, rotation1.angle);

	// peform the second rotation, and save it
	let rotation2 = Vector.getRotationFromNormals(
		origins[1].normal(),
		origins[1].orientTo(targets[1]).normal()
	);

	// if the rotation angle is PI, there are 3 possible axes that can perform the
	// rotation. however only one axis will perform the rotation while keeping
	// the first origin face on the target. this axis is the same as the origin
	// face's normal.
	if (Math.abs(rotation2.angle) === Math.PI) {
		let rotation2Axis = new Face(keys[0]).vector.getAxis();
		rotation2.axis = rotation2Axis;
	}

	return [rotation1, rotation2];
}

/**
 * @param {array} - Array of Face objects to rotate.
 * @param {array} - Array of rotations to apply to faces.
 * @return {null}
 */
function _rotateFacesByRotations(faces, rotations) {
	for (let face of faces) {
		for (let rotation of rotations) {
			face.rotate(rotation.axis, rotation.angle);
		}
	}
}

/**
 * @param {array} notations
 * @return {array}
 */
function _reverseNotations(notations) {
	const reversed = [];

	for (let notation of notations) {
		let isPrime = notation.includes('prime');
		notation = isPrime ? notation[0] : notation[0] + 'prime';
		reversed.push(notation);
	}

	return typeof moves === 'string' ? reversed.join(' ') : reversed;
}

module.exports.default = {
	getFaceOfMove,
	getMoveOfFace,
	getMiddleMatchingFace,
	getFaceMatchingMiddle,
	transformNotations,
	normalizeNotations,
	getDirectionFromFaces,
	getRotationFromTo,
	getFaceFromDirection,
	orientMoves
};


module.exports["getFaceOfMove"] = getFaceOfMove;
module.exports["getMoveOfFace"] = getMoveOfFace;
module.exports["getMiddleMatchingFace"] = getMiddleMatchingFace;
module.exports["getFaceMatchingMiddle"] = getFaceMatchingMiddle;
module.exports["transformNotations"] = transformNotations;
module.exports["normalizeNotations"] = normalizeNotations;
module.exports["getDirectionFromFaces"] = getDirectionFromFaces;
module.exports["getFaceFromDirection"] = getFaceFromDirection;
module.exports["getRotationFromTo"] = getRotationFromTo;
module.exports["orientMoves"] = orientMoves;
},
"deps/gl-vec3/angle.js":function(require,module,exports){
module.exports.default=function angle(a,b){const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2],la=Math.hypot(...a),lb=Math.hypot(...b);if(!la||!lb)return 0;return Math.acos(Math.max(-1,Math.min(1,d/(la*lb))))};
},
"deps/gl-vec3/cross.js":function(require,module,exports){
module.exports.default=function cross(out,a,b){const ax=a[0],ay=a[1],az=a[2],bx=b[0],by=b[1],bz=b[2];out[0]=ay*bz-az*by;out[1]=az*bx-ax*bz;out[2]=ax*by-ay*bx;return out};
},
"deps/gl-vec3/rotateX.js":function(require,module,exports){
module.exports.default=function rotateX(out,a,o,rad){const p=a[0]-o[0],q=a[1]-o[1],r=a[2]-o[2],c=Math.cos(rad),s=Math.sin(rad);out[0]=p+o[0];out[1]=q*c-r*s+o[1];out[2]=q*s+r*c+o[2];return out};
},
"deps/gl-vec3/rotateY.js":function(require,module,exports){
module.exports.default=function rotateY(out,a,o,rad){const p=a[0]-o[0],q=a[1]-o[1],r=a[2]-o[2],c=Math.cos(rad),s=Math.sin(rad);out[0]=r*s+p*c+o[0];out[1]=q+o[1];out[2]=r*c-p*s+o[2];return out};
},
"deps/gl-vec3/rotateZ.js":function(require,module,exports){
module.exports.default=function rotateZ(out,a,o,rad){const p=a[0]-o[0],q=a[1]-o[1],r=a[2]-o[2],c=Math.cos(rad),s=Math.sin(rad);out[0]=p*c-q*s+o[0];out[1]=p*s+q*c+o[1];out[2]=r+o[2];return out};
},
"deps/array-element-combiner.js":function(require,module,exports){
module.exports.default=function combiner(values,options){const out=[];for(const value of values){const current=value;let i=out.length-1;while(i>=0&&options.ignore&&options.ignore(out[i],current))i--;if(i>=0&&options.compare(out[i],current)){const combined=options.combine(out[i],current);out.splice(i,1);if(!(options.cancel&&options.cancel(combined)))out.splice(i,0,combined)}else out.push(current)}return out};
}};
const cache=Object.create(null);
function load(id){if(cache[id])return cache[id].exports;const factory=factories[id];if(!factory)throw new Error('Missing CFOP module: '+id);const module={exports:{}};cache[id]=module;factory(spec=>load(spec),module,module.exports);return module.exports;}
const api=load('src/index.js');global.CFOPSolve=api.default;global.CFOPSolverClass=api.Solver;global.CFOPRubiksCube=api.RubiksCube;global.CFOPReady=true;global.dispatchEvent(new Event('cfop-solver-ready'));
})(window);
