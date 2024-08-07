// main.ts

class Teleport {
	public p0: number[] = [];
	public p1: number[] = [];
	public bothWays: boolean = false;
	constructor(p0: number[], p1: number[], bothWays: boolean) {
		this.p0 = p0;
		this.p1 = p1;
		this.bothWays = bothWays;
	}
}

const teleports: Teleport[] = [];

let isDeleting: boolean = false;
let activeIndex: number = -1;
let activeColumn: number = -1;
let tick: number = 0;

const widgetUpdates = {
	workersListView(widgetName: string): void {
		let listData: string[][] = [];
		for (let i = 0; i < teleports.length; i++) {
			let color: string = isDeleting ? "{RED}" : "{WHITE}";
			let a: string = `[${teleports[i].p0.toString()}]`;
			let b: string = `[${teleports[i].p1.toString()}]`;
			if (activeIndex == i) {
				if (activeColumn == 0)
					a = "{GREEN}" + a;
				if (activeColumn == 1)
					b = "{GREEN}" + b;
			}
			listData.push([color + a, color + b, color + String(teleports[i].bothWays)]);
		}
		mainWin.win().findWidget<ListViewWidget>(widgetName).items = listData;
	}
};

const userActions = {
	add: () => {
		teleports.push(new Teleport([], [], false));
		isDeleting = false;
		mainWin.win().findWidget<ButtonWidget>("delete").isPressed = isDeleting;
		mainWin.update();
	},
	changeDeleteState: () => {
		isDeleting = !isDeleting;
		mainWin.win().findWidget<ButtonWidget>("delete").isPressed = isDeleting;
		DeActivateTool();
		mainWin.update();
	},
	listAction(index: number, column: number): void {
		// delete
		if (isDeleting) {
			teleports.splice(index, 1);
		} else {
			// activate tool
			if (column == 0 || column == 1) {
				activeIndex = index;
				activeColumn = column;
				ActivateTool();
			}
			// both ways
			else if (column == 2) {
				teleports[index].bothWays = !teleports[index].bothWays;
			}
		}
		mainWin.update();
	}
};

function DeActivateTool() {
	ui.mainViewport.visibilityFlags &= ~(1 << 7);
	if (ui.tool && ui.tool.id == "select-points-tool") {
		ui.tool.cancel();
	}
	ui.tileSelection.tiles = [];
	activeIndex = -1;
	activeColumn = -1;
}

function ActivateTool() {

	ui.mainViewport.visibilityFlags |= (1 << 7);

	let tileA = {} as CoordsXY;
	let tileB = {} as CoordsXY;

	ui.activateTool({
		id: "select-points-tool",
		cursor: "cross_hair",
		onStart() {
			tileA = { x: teleports[activeIndex].p0[0], y: teleports[activeIndex].p0[1] };
			tileB = { x: teleports[activeIndex].p1[0], y: teleports[activeIndex].p1[1] };

			ui.tileSelection.tiles = [tileA, tileB];
		},
		onDown: (e: ToolEventArgs) => {
			if (e.mapCoords !== undefined && e.tileElementIndex !== undefined) {

				const tile: Tile = map.getTile(e.mapCoords.x / 32, e.mapCoords.y / 32);

				if (activeColumn == 0)
					teleports[activeIndex].p0 = [e.mapCoords.x, e.mapCoords.y, tile.elements[e.tileElementIndex].baseZ];
				if (activeColumn == 1)
					teleports[activeIndex].p1 = [e.mapCoords.x, e.mapCoords.y, tile.elements[e.tileElementIndex].baseZ];

				ui.tileSelection.tiles = [
					{ x: teleports[activeIndex].p0[0], y: teleports[activeIndex].p0[1] },
					{ x: teleports[activeIndex].p1[0], y: teleports[activeIndex].p1[1] }
				];

				mainWin.update()
			}
		}
	});
}

function Widgets(): WidgetDesc[] {

	const widgets: WidgetDesc[] = [];

	widgets.push({
		type: "button",
		x: 5, y: 20, width: 290 / 2 - 5, height: 15,
		text: "Add new teleport",
		name: "add",
		onClick: () => userActions.add()
	});

	widgets.push({
		type: "button",
		x: 290 / 2 + 5, y: 20, width: 290 / 2, height: 15,
		text: "Delete teleport",
		name: "delete",
		isPressed: isDeleting,
		onClick: () => userActions.changeDeleteState()
	});

	widgets.push({
		type: 'listview',
		name: 'teleportsListView',
		x: 5, y: 40, width: 290, height: 100,
		scrollbars: "vertical",
		showColumnHeaders: true,
		isStriped: true,
		columns: [
			{ canSort: false, header: "{WHITE}Point A", ratioWidth: 38 },
			{ canSort: false, header: "{WHITE}Point B", ratioWidth: 38 },
			{ canSort: false, header: "{WHITE}Both ways", ratioWidth: 24 }
		],
		items: [],
		onClick: (index, column) => userActions.listAction(index, column)
	});

	widgets.push({
		type: "checkbox",
		x: 5, y: 145, width: 290, height: 15,
		text: "Save teleports",
		name: "save",
		onChange: () => { }
	});

	return widgets;

}

const mainWin = {
	classification: "multi_teleport",
	win(): Window { return ui.getWindow(mainWin.classification) },
	update(): void {
		widgetUpdates.workersListView("teleportsListView");
	},
	open(): void {
		if (mainWin.win()) {
			mainWin.win().bringToFront();
			return;
		}
		let winDesc: WindowDesc = {
			classification: mainWin.classification,
			width: 300, height: 165,
			title: "Multi teleport",
			widgets: Widgets(),
			onClose: () => {
				isDeleting = false;
				DeActivateTool();
			}
		};
		ui.openWindow(winDesc);
		mainWin.update();
	}
};

export function main(): void {

	ui.registerMenuItem("Multi teleport", mainWin.open);

	context.subscribe("interval.tick", () => {

		tick++;

		if (tick > 20) {

			for (let t in teleports) {

				if (teleports[t].p0.length < 3 || teleports[t].p1.length < 3)
					continue;

				const tile: Tile = map.getTile(teleports[t].p0[0] / 32, teleports[t].p0[1] / 32);

				let guests: Guest[] = map.getAllEntitiesOnTile("guest", { x: tile.x * 32, y: tile.y * 32 });

				guests.forEach((guest) => {

					let p0x: number = teleports[t].p0[0];
					let p0y: number = teleports[t].p0[1];
					let p0z: number = teleports[t].p0[2];

					let p1x: number = teleports[t].p1[0];
					let p1y: number = teleports[t].p1[1];
					let p1z: number = teleports[t].p1[2];

					if (guest.z >= p0z && guest.z < p0z + 16) {

						let offsetx: number = guest.x - teleports[t].p0[0];
						let offsety: number = guest.y - teleports[t].p0[1];

						guest.x = p1x + offsetx;
						guest.y = p1y + offsety;
						guest.z = p1z;

						if (guest.direction == 0) guest.destination = { x: guest.x - 32, y: guest.y };
						if (guest.direction == 1) guest.destination = { x: guest.x, y: guest.y + 32 };
						if (guest.direction == 2) guest.destination = { x: guest.x + 32, y: guest.y };
						if (guest.direction == 3) guest.destination = { x: guest.x, y: guest.y - 32 };

					}

				})

			}

			tick = 0;
		}

	});

}