// main.ts

interface StorageDefaults {
	[storageType: string]: { [memberName: string]: { path: string; value: any } }
}

const storageDefaults: StorageDefaults = {
	sharedStorage: {
		"saveTeleports": { path: "MultiTeleport.saveTeleports", value: false },
	},
	parkStorage: {
		"teleports": { path: "MultiTeleport.teleports", value: [] as Teleport[] }
	}
}

const storage = {
	sharedStorage: {
		get<T>(memberName: string): T {
			return context.sharedStorage.get(storageDefaults.sharedStorage[memberName].path, storageDefaults.sharedStorage[memberName].value) as T;
		},
		set<T>(memberName: string, value: T): void {
			context.sharedStorage.set(storageDefaults.sharedStorage[memberName].path, value);
		}
	},
	parkStorage: {
		get<T>(memberName: string): T {
			return context.getParkStorage().get(storageDefaults.parkStorage[memberName].path, storageDefaults.parkStorage[memberName].value) as T;
		},
		set<T>(memberName: string, value: T): void {
			context.getParkStorage().set(storageDefaults.parkStorage[memberName].path, value);
		}
	}
}

interface Teleport {
	p0: CoordsXYZ;
	p1: CoordsXYZ;
	bothWays: boolean;
	register: { a: number[], b: number[] };
}

function CoordsXYZToString(v: CoordsXYZ): string {
	const coords = [v.x, v.y, v.z].filter(coord => coord > -1);
	return `[${coords.join(",")}]`;
}

let teleports: Teleport[] = [];
let isDeleting: boolean = false;
let activeIndex: number = -1;
let activeColumn: number = -1;
let tick: number = 0;

const widgetUpdates = {
	teleportsListView(widgetName: string): void {
		let listData: string[][] = [];
		for (let i = 0; i < teleports.length; i++) {
			let color: string = isDeleting ? "{RED}" : "{WHITE}";
			let a: string = CoordsXYZToString(teleports[i].p0);
			let b: string = CoordsXYZToString(teleports[i].p1);
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
	add: (): void => {
		teleports.push({ p0: { x: -1, y: -1, z: -1 }, p1: { x: -1, y: -1, z: -1 }, register: { a: [], b: [] }, bothWays: false });
		userActions.listAction(teleports.length - 1, 0);
		isDeleting = false;
		mainWin.update();
	},
	changeDeleteState: (): void => {
		isDeleting = !isDeleting;
		DeActivateTool();
		mainWin.update();
	},
	listAction(index: number, column: number): void {
		if (isDeleting) {
			teleports.splice(index, 1);
		} else {
			if (column == 0 || column == 1) {
				activeIndex = index;
				activeColumn = column;
				ActivateTool();
			}
			else if (column == 2) {
				teleports[index].bothWays = !teleports[index].bothWays;
				teleports[index].register = { a: [], b: [] }; // reset
			}
		}
		mainWin.update();
	},
	saveTeleports: () => {
		let saveTeleports = storage.sharedStorage.get("saveTeleports");
		storage.sharedStorage.set("saveTeleports", !saveTeleports);
		mainWin.update();
	}
};

function DeActivateTool(): void {
	ui.mainViewport.visibilityFlags &= ~(1 << 7);
	if (ui.tool && ui.tool.id == "select-points-tool") {
		ui.tool.cancel();
	}
	ui.tileSelection.tiles = [];
	activeIndex = -1;
	activeColumn = -1;
}

function ActivateTool(): void {

	ui.mainViewport.visibilityFlags |= (1 << 7);

	let tileA = {} as CoordsXY;
	let tileB = {} as CoordsXY;

	ui.activateTool({
		id: "select-points-tool",
		cursor: "cross_hair",
		onStart() {
			tileA = { x: teleports[activeIndex].p0.x, y: teleports[activeIndex].p0.y };
			tileB = { x: teleports[activeIndex].p1.x, y: teleports[activeIndex].p1.y };

			ui.tileSelection.tiles = [tileA, tileB];
		},
		onDown: (e: ToolEventArgs) => {
			if (e.mapCoords !== undefined && e.tileElementIndex !== undefined) {

				const tile: Tile = map.getTile(e.mapCoords.x / 32, e.mapCoords.y / 32);

				if (activeColumn == 0)
					teleports[activeIndex].p0 = { x: e.mapCoords.x, y: e.mapCoords.y, z: tile.elements[e.tileElementIndex].baseZ };
				if (activeColumn == 1)
					teleports[activeIndex].p1 = { x: e.mapCoords.x, y: e.mapCoords.y, z: tile.elements[e.tileElementIndex].baseZ };

				ui.tileSelection.tiles = [
					{ x: teleports[activeIndex].p0.x, y: teleports[activeIndex].p0.y },
					{ x: teleports[activeIndex].p1.x, y: teleports[activeIndex].p1.y }
				];

				mainWin.update();
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
		name: "saveTeleports",
		tooltip: "When game is saved, teleports are too.",
		isChecked: storage.sharedStorage.get("saveTeleports"),
		onChange: () => userActions.saveTeleports()
	});

	return widgets;

}

const mainWin = {
	classification: "multi_teleport",
	win(): Window { return ui.getWindow(mainWin.classification) },
	update(): void {
		widgetUpdates.teleportsListView("teleportsListView");
		mainWin.win().findWidget<ButtonWidget>("delete").isPressed = isDeleting;
		if (storage.sharedStorage.get("saveTeleports"))
			storage.parkStorage.set("teleports", teleports);
		else
			storage.parkStorage.set("teleports", []);
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

function IsTeleportSet(teleport: Teleport): boolean {
	return teleport.p0.x > -1 && teleport.p0.y > -1 && teleport.p0.z > -1 &&
		teleport.p1.x > -1 && teleport.p1.y > -1 && teleport.p1.z > -1;
}

function GuestsOnTile(tile: Tile): Guest[] {
	return map.getAllEntitiesOnTile("guest", { x: tile.x * 32, y: tile.y * 32 });
}

function IsSameZ(guest: Guest, teleportCoords: CoordsXYZ): boolean {
	return guest.z >= teleportCoords.z && guest.z < teleportCoords.z + 16
}

function IsNotYetRegistered(guestId: number, teleport: Teleport): boolean {
	return teleport.register.a.indexOf(guestId) === -1 && teleport.register.b.indexOf(guestId) === -1
}

function SetGuestNewPos(guest: Guest, coordsFrom: CoordsXYZ, coordsTo: CoordsXYZ): void {
	let offsetx: number = guest.x - coordsFrom.x;
	let offsety: number = guest.y - coordsFrom.y;

	guest.x = coordsTo.x + offsetx;
	guest.y = coordsTo.y + offsety;
	guest.z = coordsTo.z;

	if (guest.direction == 0) guest.destination = { x: guest.x - 32, y: guest.y };
	if (guest.direction == 1) guest.destination = { x: guest.x, y: guest.y + 32 };
	if (guest.direction == 2) guest.destination = { x: guest.x + 32, y: guest.y };
	if (guest.direction == 3) guest.destination = { x: guest.x, y: guest.y - 32 };
}

function RemoveGuestsFromRegister(register: number[], guests: Guest[]) {
	for (let i = register.length - 1; i >= 0; i--) {
		if (guests.every(guest => guest.id !== register[i])) {
			register.splice(i, 1);
		}
	}
}

export function main(): void {

	teleports = storage.parkStorage.get("teleports") as Teleport[];

	ui.registerMenuItem("Multi teleport", mainWin.open);

	context.subscribe("interval.tick", () => {

		tick++;

		if (tick > 20) {

			teleports.forEach((teleport) => {

				if (IsTeleportSet(teleport)) {

					const tileA: Tile = map.getTile(teleport.p0.x / 32, teleport.p0.y / 32);
					const tileB: Tile = map.getTile(teleport.p1.x / 32, teleport.p1.y / 32);

					GuestsOnTile(tileA).forEach((guest) => {
						if (IsSameZ(guest, teleport.p0)) {
							if (teleport.bothWays) {
								if (IsNotYetRegistered(Number(guest.id), teleport)) {
									teleport.register.a.push(Number(guest.id));
									SetGuestNewPos(guest, teleport.p0, teleport.p1);
								}
							} else {
								SetGuestNewPos(guest, teleport.p0, teleport.p1);
							}
						}
					});

					if (teleport.bothWays) {
						GuestsOnTile(tileB).forEach((guest) => {
							if (IsSameZ(guest, teleport.p1)) {
								if (IsNotYetRegistered(Number(guest.id), teleport)) {
									teleport.register.b.push(Number(guest.id));
									SetGuestNewPos(guest, teleport.p1, teleport.p0);
								}
							}
						});

						RemoveGuestsFromRegister(teleport.register.a, GuestsOnTile(tileB));
						RemoveGuestsFromRegister(teleport.register.b, GuestsOnTile(tileA));

					}

				}

			});

			tick = 0;
		}

	});

}