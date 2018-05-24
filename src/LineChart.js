
/* @flow */
import React, { Component } from 'react';
import { Animated, ART, View, Platform, TouchableOpacity, Text } from 'react-native';
const { Surface, Shape, Path } = ART;
import * as C from './constants';
import Circle from './Circle';
const AnimatedShape = Animated.createAnimatedComponent(Shape);
import Grid from './Grid';
import { uniqueValuesInDataSets } from './util';
import ViewOverflow from 'react-native-view-overflow';

export class MyText extends Component<void, any, any> {
	constructor(props) {
		super(props);
		this.state = {
			text: props.text || "",
		};
	}
	render() {
		return (
			<Text style={{
				zIndex: 999999999, marginHorizontal: 6, fontFamily: 'CircularStd-Book',
				fontSize: 11,
				color: '#fff',
				letterSpacing: -0.2,
				lineHeight: 16,
			}}>{this.state.text}</Text>
		)
	}

	setText(text) {
		this.setState({ text: text });
	}

}

const makeDataPoint = (x: number, y: number, data: any, index: number) => {

	let color = (data.color[index]) ? data.color[index] : C.BLUE;

	let fill = ((data.dataPointFillColor) && (data.dataPointFillColor[index])) ?
		(data.dataPointFillColor[index]) : color;

	let stroke = ((data.dataPointColor) && (data.dataPointColor[index])) ?
		(data.dataPointColor[index]) : color;

	return {
		x,
		y,
		radius: data.dataPointRadius,
		fill: fill,
		stroke: stroke
	};
};

const calculateDivisor = (minBound: number, maxBound: number): number => {
	return (maxBound - minBound <= 0) ? 0.00001 : maxBound - minBound;
};

const heightZero = (Platform.OS === 'ios') ? 0 : 1;

export default class LineChart extends Component<void, any, any> {

	myText;

	constructor(props: any) {
		super(props);
		const heightValue = (props.animated) ? heightZero : props.height;
		const opacityValue = (props.animated) ? 0 : 1;
		this.state = { height: new Animated.Value(heightValue), opacity: new Animated.Value(opacityValue) };
	}

	componentWillUpdate() {
		if (this.props.animated) {
			Animated.timing(this.state.opacity, { duration: 0, toValue: 0 }).start();
			Animated.timing(this.state.height, { duration: 0, toValue: heightZero }).start();
		}
	}

	componentDidUpdate() {
		if (this.props.animated) {
			Animated.timing(this.state.height, { duration: this.props.animationDuration, toValue: this.props.height }).start();
			Animated.timing(this.state.opacity, { duration: this.props.animationDuration, toValue: 1 }).start();
		}
	}

	_drawLine = () => {
		const containerHeight = this.props.height;
		const containerWidth = this.props.width;
		const data = this.props.data || [[]];
		let minBound = this.props.minVerticalBound;
		let maxBound = this.props.maxVerticalBound;

		// For all same values, create a range anyway
		if (minBound === maxBound) {
			minBound -= this.props.verticalGridStep;
			maxBound += this.props.verticalGridStep;
		}

		const divisor = calculateDivisor(minBound, maxBound);
		const scale = (containerHeight + 1) / divisor;
		const horizontalStep = containerWidth / uniqueValuesInDataSets(data, 0).length;

		const dataPoints = [];
		const path = [];
		const fillPath = [];

		for (index = 0; index < data.length; index++) {
			var pathArray = [], fillPathArray = [], pathSubIndex = -1;
			let currentData = data[index] || [];
			const firstDataPoint = currentData[0][1];
			let height = (minBound * scale) + (containerHeight - (firstDataPoint * scale));
			if (height < 0) height = 0;

			const dataPointSet = [];
			dataPointSet.push(makeDataPoint(0, height, this.props, index));

			let beginNewPath = true;
			currentData.forEach(([_, dataPoint], i) => {

				if (dataPoint === '') {
					// An empty within the graph, begin new Path next non-empty datapoint
					// beginNewPath = true;
					return;
				}

				let _height = (minBound * scale) + (containerHeight - (dataPoint * scale));
				if (_height < 0) _height = 0;

				const x = horizontalStep * (i);
				const y = Math.round(_height);

				dataPointSet.push(makeDataPoint(x, y, this.props, index));

				if ((beginNewPath) && (dataPoint !== '')) {
					pathArray.push(new Path().moveTo(x, y));
					fillPathArray.push(new Path().moveTo(x, containerHeight).lineTo(x, height));
					pathSubIndex++;
					beginNewPath = false;
				} else {
					pathArray[pathSubIndex].lineTo(x, y);
					fillPathArray[pathSubIndex].lineTo(x, y);
				}
			});

			dataPoints.push(dataPointSet);

			for (g = 0; g < pathArray.length; g++) {
				fillPathArray[g].lineTo(dataPointSet[dataPointSet.length - 1].x, containerHeight);
				if (this.props.fillColor) {
					fillPathArray[g].moveTo(0, containerHeight);
				}

				if (pathArray[g].path.some(isNaN)) return null;
			}

			path.push(pathArray);
			fillPath.push(fillPathArray);
		}

		var multipleLines = dataPoints.map((dataPointSet, index) => {
			let color = (this.props.color[index]) ? this.props.color[index] : C.BLUE;
			let allDisjointPaths = path[index].map((singlePath) => {
				return (
					<AnimatedShape d={singlePath} stroke={this.props.color[index] || C.BLUE} strokeWidth={this.props.lineWidth} />
				);
			});
			return allDisjointPaths;
		});

		var multipleFills = dataPoints.map((dataPointSet, index) => {
			let allDisjointPaths = fillPath[index].map((singlePath, subIndex) => {
				return (
					<AnimatedShape d={singlePath} fill={this.props.fillColor} />
				);
			});
			return allDisjointPaths;
		});

		return (
			<ViewOverflow style={{ overflow: 'visible' }} >
				<View style={{ position: 'absolute' }}>
					<Surface width={containerWidth} height={containerHeight}>
						{multipleLines}
						{multipleFills}
					</Surface>
				</View>
				<View style={{ position: 'absolute' }}>
					<Surface width={containerWidth} height={containerHeight} />
				</View>
				{(() => {
					if (!this.props.showDataPoint) return null;
					let point = dataPoints[0][Math.min(3, dataPoints[0].length)];
					let animatedX = new Animated.Value(-200);
					let animatedY = new Animated.Value(0);
					let label = "";
					if (point) {
						label = Math.round((maxBound * (1 - (point.y / containerHeight))) + minBound).toString();
						animatedX = new Animated.Value(point.x - 8);
						animatedY = new Animated.Value(point.y - 8);
					}
					let interpolatedY = animatedY.interpolate({
						inputRange: [0, containerHeight],
						outputRange: [0 - 30, containerHeight - 30],
					});
					let interpolatedX = animatedX.interpolate({
						inputRange: [0, containerWidth],
						outputRange: [0 - 42, containerWidth - 42],
					});
					return (
						<ViewOverflow style={{ width: containerWidth, height: containerHeight, backgroundColor: "transparent", overflow: 'visible' }}
							onStartShouldSetResponder={() => true}
							onMoveShouldSetResponder={() => true}
							onResponderGrant={() => {
								this.props.onTouchStart && this.props.onTouchStart();
							}}
							onResponderRelease={() => {
								this.props.onTouchEnd && this.props.onTouchEnd();
							}}
							onResponderMove={e => {
								if (dataPoints[0].length > 0) {
									let tX = e.nativeEvent.pageX - 30
									let previus = Math.floor(tX / horizontalStep);
									let next = Math.ceil(tX / horizontalStep);
									let xRest = (tX / horizontalStep) - previus;
									let yPoint;
									let xPoint;
									let label;
									if (dataPoints[0][next]) {
										if (dataPoints[0].length < 2) {
											yPoint = dataPoints[0][dataPoints[0].length - 1].y
											xPoint = dataPoints[0][dataPoints[0].length - 1].x
										} else if (!dataPoints[0][previus]) {
											previus = 0;
											next = 1;
										}
										let yDiff = dataPoints[0][previus].y - dataPoints[0][next].y
										let xDiff = dataPoints[0][previus].x - dataPoints[0][next].x
										yPoint = xRest == 0 ? dataPoints[0][previus].y : (dataPoints[0][previus].y - (yDiff * xRest))
										xPoint = xRest == 0 ? dataPoints[0][previus].x : (dataPoints[0][previus].x - (xDiff * xRest))
									} else {
										if (previus < 0) {
											yPoint = dataPoints[0][0].y
											xPoint = dataPoints[0][0].x
										} else {
											yPoint = dataPoints[0][dataPoints[0].length - 1].y
											xPoint = dataPoints[0][dataPoints[0].length - 1].x
										}
									}
									let text = Math.round((maxBound * (1 - (yPoint / containerHeight))) + minBound).toString();
									this.myText && this.myText.setText(text)
									Animated.parallel([
										Animated.timing(animatedX, {
											duration: 0,
											toValue: xPoint - 8,
										}),
										Animated.timing(animatedY, {
											duration: 0,
											toValue: yPoint - 8,
										})
									]).start();
								}
							}} >
							<Animated.View style={{ position: 'absolute', backgroundColor: 'transparent', alignItems: 'center', width: 100, height: 80, left: interpolatedX, top: interpolatedY, flexDirection: 'row' }} >
								<View style={{ flex: 1, alignItems: 'center', }} >
									<View style={{ backgroundColor: 'rgba(77, 77, 77, 1)', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }} >
										<MyText ref={(view) => { this.myText = view }} text={label} />
									</View>
									<View style={{ flex: 1, alignItems: 'center' }} >
										<View style={{
											width: 6,
											height: 0,
											borderTopColor: 'rgba(77, 77, 77, 1)',
											backgroundColor: 'transparent',
											borderStyle: 'solid',
											borderLeftWidth: 3,
											borderRightWidth: 3,
											borderTopWidth: 6,
											borderLeftColor: 'transparent',
											borderRightColor: 'transparent',
										}} />
									</View>
								</View>
							</Animated.View>
							<Animated.View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: 'rgba(207, 180, 110, 1)', backgroundColor: '#fff', left: animatedX, top: animatedY }} />
						</ViewOverflow>
					);
				})()}
			</ViewOverflow>
		);
	};

	render(): any {
		if (Platform.OS === 'ios') {
			return (
				<View style={{ overflow: 'hidden' }}>
					<Grid {...this.props} />
					<Animated.View style={{ height: this.state.height, opacity: this.state.opacity, backgroundColor: 'transparent' }}>
						{this._drawLine()}
					</Animated.View>
				</View>
			);
		}
		return (
			<View>
				<Grid {...this.props} />
				<View style={{ height: this.props.height }}>
					{this._drawLine()}
				</View>
			</View>
		);
	}
}
