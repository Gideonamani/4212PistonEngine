"""Power edges exclude supporting pins, mounting pads and seals from torque arrows."""
EDGES={
 'magnetos':[('CrankGear','IdlerGear'),('IdlerGear','LeftMagGear'),('IdlerGear','RightMagGear'),('LeftMagGear','LeftMagShaft'),('RightMagGear','RightMagShaft'),('LeftMagShaft','LeftMagneto'),('RightMagShaft','RightMagneto')],
 'fuel':[('CrankGear','CamGear'),('CamGear','CamCluster'),('CamCluster','FuelGear'),('FuelGear','FuelGearShaft'),('FuelGearShaft','FuelCoupling'),('FuelCoupling','FuelPumpInput'),('FuelPumpInput','FuelPump')],
 'oil-tach':[('CrankGear','CamGear'),('CamGear','OilTachShaft'),('OilTachShaft','OilDriver'),('OilDriver','OilDriven'),('OilTachShaft','TachDriveBevel'),('TachDriveBevel','TachDrivenBevel'),('TachDrivenBevel','TachOutput')],
 'starter':[('StarterMotor','StarterWorm'),('StarterWorm','WormWheel'),('WormWheel','ClutchSpring'),('ClutchSpring','StarterDrum'),('StarterDrum','StarterShaftGear'),('StarterShaftGear','CrankGear')],
 'alternator':[('CrankGear','AlternatorDrivenGear'),('AlternatorDrivenGear','AlternatorClutch'),('AlternatorClutch','AlternatorHub'),('AlternatorHub','AlternatorOutput'),('AlternatorOutput','AlternatorBody')],
 'vacuum':[('CrankGear','IdlerGear'),('IdlerGear','LeftMagGear'),('LeftMagGear','LeftMagShaft'),('LeftMagShaft','VacuumOutput'),('VacuumOutput','VacuumBody')],
 'governor':[('CrankGear','CamGear'),('CamGear','CamShaft'),('CamShaft','GovernorOutput'),('GovernorOutput','GovernorBody')]
}
