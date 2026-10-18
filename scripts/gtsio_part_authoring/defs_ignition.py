from lib import *

L9 = "Lesson 9, Accessories and Drives"
L16 = "Lesson 16, Maintenance and Servicing"
GEN = "standard practice; the overhaul manual does not say"
MODEL = "the R10 model's material for this part; no manual or lesson states it"
IGN = MAN + ", 3-2d"
MDRV = MAN + ", figure A-4-11 and 3-2a.2"
NOIPC = "The 1969 IO-520 catalogue lists a spark plug as one part; "

# ---------------------------------------------------------------- spark plug
D('spark-plug-shell', 'Spark plug shell', 'ignition',
  F("Forms the threaded metal body that screws into the cylinder head and carries the electrode at the firing end.", 'i', "the usual construction of a spark plug; no manual or lesson describes the shell"),
  F("Screwed into a thread insert in the cylinder head: two plugs per cylinder, an upper and a lower, twelve in all.", 's', IGN + "; " + MAN + ", 3-1c and Lesson 5"),
  W(['spark-plug-insulator', 'spark-plug-terminal', 'spark-plug-gasket', 'spark-plug-thread-insert', 'cylinder-head'], 'd', IGN),
  LOOK("Find the threaded end that screws into the head and the hex that a wrench grips."),
  ('d', "The catalogue lists a 'Spark Plug' as one part; the model draws it in pieces and names them from their jobs"),
  made=F("steel", 'i', MODEL),
  cat=("Spark Plug", 'io520'),
  terms=['spark plug'],
  man=[],
  align=('io520_only', 'The 1969 IO-520 catalogue lists a spark plug as one part. The model draws shell, insulator, terminal and gasket as separate parts.'),
  locators=[], family='Spark plug part')

D('spark-plug-insulator', 'Spark plug insulator', 'ignition',
  F("Keeps the high voltage inside the plug so the spark jumps at the firing end, not along the body.", 'i', "the usual job of a plug insulator; the course text only warns that a cracked one must not be used"),
  F("Inside the plug shell, running from the firing end up to the terminal.", 'i', "the usual construction of a spark plug"),
  W(['spark-plug-shell', 'spark-plug-terminal'], 'd', IGN),
  LOOK("Find the white ceramic part and see how far it runs inside the metal shell."),
  ('d', "The catalogue lists a 'Spark Plug' as one part; the model draws the insulator separately, and Lesson 16 uses the word"),
  made=F("ceramic", 'i', MODEL),
  cat=("Spark Plug", 'io520'),
  terms=['insulator'],
  man=[],
  align=('io520_only', 'The 1969 IO-520 catalogue lists a spark plug as one part; the model draws the insulator as a separate part.'),
  locators=[], family='Spark plug part')

D('spark-plug-terminal', 'Spark plug terminal', 'ignition',
  F("Receives the ignition lead from the magneto and passes the high voltage into the plug.", 'd', IGN + ": spark is transmitted to the spark plugs through high tension cables connected to the plugs by nuts"),
  F("At the outer end of each spark plug, where the ignition lead connects.", 'd', IGN),
  W(['spark-plug-insulator', 'spark-plug-shell'], 'd', IGN),
  LOOK("Find the connector end where the lead nut screws on."),
  ('d', "The catalogue lists a 'Spark Plug' as one part; the model draws the terminal end separately"),
  made=F("steel", 'i', MODEL),
  cat=("Spark Plug", 'io520'),
  man=[],
  align=('io520_only', 'The 1969 IO-520 catalogue lists a spark plug as one part; the model draws the terminal end as a separate part.'),
  locators=[], family='Spark plug part')

D('spark-plug-gasket', 'Spark plug gasket', 'ignition',
  F("Seals the joint between the spark plug and the cylinder head.", 'i', "the usual job of a plug gasket; the manual does not mention it"),
  F("Under the hex of each spark plug, against the cylinder head.", 'i', "the usual fitting of a plug gasket"),
  W(['spark-plug-shell', 'spark-plug-thread-insert', 'cylinder-head'], 'd', IGN),
  LOOK("Find the soft ring under the hex of a spark plug."),
  ('d', "Neither book lists a plug gasket as a separate part; the name describes its job"),
  made=F("copper", 'i', MODEL),
  cat=None,
  man=[],
  align=('not_found', 'Neither the IO-520 catalogue nor the GTSIO manual figure keys list a spark plug gasket.'),
  locators=[], family='Spark plug part')

D('spark-plug-thread-insert', 'Spark plug thread insert', 'ignition',
  F("Gives each spark plug a strong, replaceable thread in the aluminium cylinder head.", 'd', MAN + ", 3-1c: special 18mm helical coil thread inserts are installed in the spark plug holes"),
  F("Fitted in both spark plug holes of each cylinder head, an upper and a lower.", 's', MAN + ", 3-1c"),
  W(['spark-plug-shell', 'cylinder-head'], 'd', MAN + ", 3-1c"),
  LOOK("Find the coiled thread inside a plug hole."),
  ('s', MAN + " figure key"),
  made=F("steel", 'i', MODEL),
  cat=("Insert, Spark Plug Thread", 'gtsio'),
  man=[M('A-4-17', 42)],
  align=('gtsio_only', 'The name comes from the GTSIO manual figure key (A-4-17 callout 42).'),
  locators=['A-4-17:42'])

# ---------------------------------------------------------------- magneto drive adapter, rear
D('magneto-drive-gear', 'Magneto drive gear', 'ignition',
  F("Is turned by the idler gear and drives a magneto through its internal splines.", 's', MAN + ", 3-2a.2"),
  F("In the magneto drive adapter on each side of the rear of the crankcase, meshing with the idler gear.", 's', MAN + ", 3-2a.2"),
  W(['idler-gear', 'drive-gear-sleeve', 'magneto-drive-adapter', 'drive-coupling-bushing'], 'd', MDRV),
  LOOK("Find the gear that meshes with the idler and the splined bore it turns the magneto with."),
  ('s', IPC),
  made=F("steel", 'i', MODEL),
  cat=("Gear Assembly, Magneto & Accessory Drive", 'io520'),
  terms=['magneto drive gear'],
  man=[M('A-4-11', 16), M('A-4-8', 14), M('A-4-8', 15)],
  align=('confirmed', 'Gear Assembly, Magneto & Accessory Drive in the IO-520 book; callouts 14 and 15 of the gear train diagram.'),
  locators=['A-4-8:14', 'A-4-8:15', 'A-4-11:16'])

D('magneto-adapter-bushing', 'Adapter bushing', 'ignition',
  F("Lines the bore of the drive adapter so the magneto drive gear turns smoothly.", 'i', "bushings in general line a bore; the manual only names it"),
  F("Pressed into the magneto drive adapter, around the drive gear.", 'd', MAN + ", figure A-4-11 callout 14"),
  W(['magneto-drive-adapter', 'magneto-drive-gear'], 'd', MDRV),
  LOOK("Find the sleeve inside the adapter."),
  ('s', IPC),
  made=F("bronze", 'i', MODEL),
  cat=("Bushing, Adapter", 'io520'),
  man=[M('A-4-11', 14)],
  align=('confirmed', 'Same name in the IO-520 book and the GTSIO manual.'),
  locators=['A-4-11:14'])

D('drive-gear-sleeve', 'Drive gear sleeve', 'ignition',
  F("Fits inside the drive gear and carries the splines that turn the magneto.", 'i', "the name and position suggest it; the manual only names it"),
  F("Inside the magneto drive gear.", 'd', MAN + ", figure A-4-11 callout 19"),
  W(['magneto-drive-gear', 'drive-coupling-bushing'], 'd', MDRV),
  LOOK("Find the splined sleeve in the middle of the drive gear."),
  ('s', IPC),
  made=F("steel", 'i', MODEL),
  cat=("Sleeve, Drive Gear", 'io520'),
  man=[M('A-4-11', 19), M('A-4-11', 23)],
  align=('confirmed', 'Same name in the IO-520 book and the GTSIO manual.'),
  locators=['A-4-11:19', 'A-4-11:23'])

D('magneto-drive-oil-seal', 'Oil seal', 'ignition',
  F("Keeps engine oil from escaping along the magneto drive.", 'i', "the usual job of an oil seal; the manual only names it"),
  F("In the magneto drive adapter, behind the drive gear.", 'd', MAN + ", figure A-4-11 callout 15"),
  W(['magneto-drive-adapter', 'magneto-drive-gear'], 'd', MDRV),
  LOOK("Find the ring seal at the mouth of the adapter."),
  ('s', IPC),
  made=F("rubber", 'i', MODEL),
  cat=("Seal, Oil", 'io520'),
  man=[M('A-4-11', 15)],
  align=('confirmed', 'Named in both the IO-520 parts catalogue and the GTSIO manual figure key.'),
  locators=['A-4-11:15'], family='Oil seal')

D('drive-coupling-bushing', 'Drive coupling bushing', 'ignition',
  F("Cushions the connection between the drive gear and the magneto shaft.", 'i', "the IO-520 catalogue calls it a rubber bushing, which suggests a cushioning job; the manual only names it"),
  F("In the drive gear, where the magneto coupling engages.", 'd', MAN + ", figure A-4-11 callout 17"),
  W(['magneto-drive-gear', 'magneto-coupling-retainer'], 'd', MDRV),
  LOOK("Find the rubber ring in the drive gear."),
  ('s', IPC),
  made=F("rubber", 's', "its name in the IO-520 parts catalogue: 'Bushing, Drive Coupling, Rubber'"),
  cat=("Bushing, Drive Coupling, Rubber", 'io520'),
  man=[M('A-4-11', 17)],
  align=('confirmed', 'Same name in the IO-520 book and the GTSIO manual.'),
  locators=['A-4-11:17'])

D('magneto-coupling-retainer', 'Magneto coupling retainer', 'ignition',
  F("Holds the drive coupling bushing in the drive gear.", 'i', "the name says it retains the coupling; the manual only names it"),
  F("At the end of the drive gear, over the coupling bushing.", 'd', MAN + ", figure A-4-11 callout 18"),
  W(['drive-coupling-bushing', 'magneto-drive-gear'], 'd', MDRV),
  LOOK("Find the small plate that holds the rubber bushing in."),
  ('s', IPC),
  made=F("steel", 'i', MODEL),
  cat=("Retainer, Magneto Drive Coupling", 'io520'),
  man=[M('A-4-11', 18)],
  align=('confirmed', 'Named in both the IO-520 parts catalogue and the GTSIO manual figure key.'),
  locators=['A-4-11:18'])

D('magneto-drive-adapter', 'Magneto drive adapter', 'ignition',
  F("Holds the magneto drive gear and the magneto at the rear of the crankcase.", 'd', MAN + ", 3-2a.2 and figure A-4-11 callout 12"),
  F("Bolted to the upper rear of each side of the crankcase.", 'd', MAN + ", 3-2a.2"),
  W(['magneto-drive-gear', 'magneto-adapter-gasket', 'magneto-adapter-bolt', 'crankcase'], 'd', MDRV),
  LOOK("Find the housing on each side at the rear of the crankcase."),
  ('d', "The catalogue says 'Adapter Assembly, Magneto & Accessory Drive'; the name is shortened to the magneto job"),
  made=F("aluminium alloy", 'i', MODEL),
  aliases=['accessory adapter'],
  cat=("Adapter Assembly, Magneto & Accessory Drive", 'io520'),
  man=[M('A-4-11', 12)],
  align=('confirmed', "Same function in the IO-520 book and the GTSIO manual (manual 'Adapter, Accessory')."),
  locators=['A-4-11:12'])

D('magneto-adapter-gasket', 'Adapter gasket', 'ignition',
  F("Seals the joint between the magneto drive adapter and the crankcase.", 'd', MAN + ", figure A-4-11 callout 13"),
  F("Between each magneto drive adapter and the crankcase.", 'd', MAN + ", figure A-4-11"),
  W(['magneto-drive-adapter', 'crankcase'], 'd', MDRV),
  LOOK("Find the thin layer between the adapter and the case."),
  ('s', IPC),
  made=F("gasket material", 'i', "gaskets are made from sheet seal material; the manual does not name it"),
  cat=("Gasket, Adapter-to-Crankcase", 'io520'),
  man=[M('A-4-11', 13)],
  align=('confirmed', 'Same function in the IO-520 book and the GTSIO manual.'),
  locators=['A-4-11:13'], family='Adapter gasket')

D('magneto-adapter-bolt', 'Stud', 'ignition',
  F("Holds the magneto drive adapter against the crankcase.", 'd', MAN + ", figure A-4-11 callouts 6 to 11"),
  F("Four fasteners round each magneto drive adapter.", 'd', "R10 model layout"),
  W(['magneto-drive-adapter', 'magneto-adapter-gasket'], 'd', MDRV),
  LOOK("Count the fasteners that hold one adapter."),
  ('s', IPC),
  made=F("steel", 'i', GEN),
  cat=("Stud, 1/4 x 1-3/8 inch long", 'io520'),
  man=[M('A-4-11', 6)],
  align=('mismatch', "The R10 model calls these 'adapter bolts'. The IO-520 book lists studs here (four per adapter) with nuts and washers, and the manual shows nuts. The model draws bolts."),
  locators=['A-4-11:6'], family='Stud')
