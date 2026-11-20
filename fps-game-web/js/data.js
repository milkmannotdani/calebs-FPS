// Auto-generated from the original Unity build's ScriptableObjects (GunData, LoadoutData, AttachmentData).
// Positions are in the web game's coordinate system (Unity z flipped).
export const GUNS = {
 "AK12": {
  "Name": "KC AK12",
  "HipPositionalOffset": [
   0.06,
   -0.06,
   0.43
  ],
  "HipRotationalOffset": [
   0.0,
   180.0,
   0.0
  ],
  "AimPositionalOffset": [
   0.0,
   -0.0585,
   0.33
  ],
  "AimRotationalOffset": [
   0.0,
   180.0,
   0.0
  ],
  "NetworkPositionalOffset": [
   0.298,
   0.0,
   0.422
  ],
  "NetworkRotationalOffset": [
   0.0,
   0.0,
   0.0
  ],
  "HipAimSpring": 500.0,
  "HipAimDrag": 25.0,
  "Damage": 25.0,
  "DamageMultiplierPerMeter": 0.95,
  "Range": 70.0,
  "SpreadAngleIncreasePerShot": 5.0,
  "SpreadAngleReductionPerSecond": 10.0,
  "MaxShootSpreadAngle": 10.0,
  "MovementSpreadAngleMultiplier": 1.0,
  "Rpm": 600.0,
  "ShootingType": 0,
  "MaxAmmo": 30,
  "Ammo": 30,
  "MaxStoredAmmo": 300,
  "StoredAmmo": 30,
  "ReloadTime": 1.85,
  "SwayMultiplier": 3.0,
  "SwaySpring": 100.0,
  "SwayDrag": 10.0,
  "MaxMouseDelta": 5.0,
  "BobSpeedThreshold": 1.0,
  "BobStepMultiplier": 0.025,
  "BobMultiplier": [
   0.25,
   0.5,
   0.25
  ],
  "BobSpring": 100.0,
  "BobDrag": 10.0,
  "VisualPositionalRecoil": [
   0.0,
   0.0,
   -0.7
  ],
  "VisualPositionalRecoilSpring": 200.0,
  "VisualPositionalRecoilDrag": 10.0,
  "VisualRotationalRecoil": [
   22.5,
   18.0,
   0.0
  ],
  "VisualRotationalRecoilSpring": 200.0,
  "VisualRotationalRecoilDrag": 10.0,
  "Recoil": [
   -15.0,
   10.0
  ],
  "recoilDrag": 10.0,
  "FovLerpSpeed": 10.0,
  "Optics": [
   "NoOptic",
   "RedDotSight",
   "Holosight",
   "SniperScope"
  ],
  "Lasers": [
   "NoLaser",
   "RedLaser",
   "GreenLaser"
  ],
  "Grips": [
   "NoGrip",
   "HollowLongGrip",
   "HollowShortGrip",
   "VerticalGrip"
  ],
  "GunshotVolume": 1.0,
  "GunshotPitch": 1.0,
  "GunshotPitchVariance": 0.1,
  "AmmoToIncreaseGunshotPitch": 5,
  "LowAmmoAdditionalPitch": 0.5,
  "model": "gun_ak12",
  "icon": "assault_01",
  "useMount": false,
  "points": {
   "Barrel": [
    0.0,
    0.0,
    0.4552
   ],
   "OpticAttachmentPoint": [
    0.0,
    0.0398,
    -0.1194
   ],
   "LaserAttachmentPoint": [
    0.0,
    -0.0265,
    0.1318
   ],
   "GripAttachmentPoint": [
    0.0,
    -0.0265,
    0.0717
   ]
  }
 },
 "BT .50 Cal": {
  "Name": "BT .50 Cal",
  "HipPositionalOffset": [
   0.055,
   -0.072,
   0.353
  ],
  "HipRotationalOffset": [
   0.9883,
   180.0,
   0.0
  ],
  "AimPositionalOffset": [
   0.0,
   -0.067,
   0.358
  ],
  "AimRotationalOffset": [
   0.0,
   180.0,
   0.0
  ],
  "NetworkPositionalOffset": [
   0.313,
   0.01,
   0.573
  ],
  "NetworkRotationalOffset": [
   0.0,
   0.0,
   0.0
  ],
  "HipAimSpring": 400.0,
  "HipAimDrag": 25.0,
  "Damage": 125.0,
  "DamageMultiplierPerMeter": 0.925,
  "Range": 70.0,
  "SpreadAngleIncreasePerShot": 10.0,
  "SpreadAngleReductionPerSecond": 7.5,
  "MaxShootSpreadAngle": 15.0,
  "MovementSpreadAngleMultiplier": 1.0,
  "Rpm": 400.0,
  "ShootingType": 1,
  "MaxAmmo": 5,
  "Ammo": 30,
  "MaxStoredAmmo": 50,
  "StoredAmmo": 30,
  "ReloadTime": 1.65,
  "SwayMultiplier": 3.0,
  "SwaySpring": 100.0,
  "SwayDrag": 10.0,
  "MaxMouseDelta": 5.0,
  "BobSpeedThreshold": 0.1,
  "BobStepMultiplier": 0.025,
  "BobMultiplier": [
   0.2,
   1.0,
   0.2
  ],
  "BobSpring": 100.0,
  "BobDrag": 10.0,
  "VisualPositionalRecoil": [
   0.0,
   0.0,
   -0.85
  ],
  "VisualPositionalRecoilSpring": 100.0,
  "VisualPositionalRecoilDrag": 8.0,
  "VisualRotationalRecoil": [
   25.0,
   20.0,
   0.0
  ],
  "VisualRotationalRecoilSpring": 100.0,
  "VisualRotationalRecoilDrag": 10.0,
  "Recoil": [
   -35.0,
   20.0
  ],
  "recoilDrag": 10.0,
  "FovLerpSpeed": 8.0,
  "Optics": [
   "NoOptic",
   "RedDotSight",
   "Holosight",
   "SniperScope"
  ],
  "Lasers": [
   "NoLaser",
   "RedLaser",
   "GreenLaser"
  ],
  "Grips": [
   "NoGrip",
   "HollowLongGrip",
   "HollowShortGrip",
   "VerticalGrip"
  ],
  "GunshotVolume": 1.0,
  "GunshotPitch": 0.8,
  "GunshotPitchVariance": 0.1,
  "AmmoToIncreaseGunshotPitch": 0,
  "LowAmmoAdditionalPitch": 0.0,
  "model": "gun_m107",
  "icon": "sniper_03",
  "useMount": false,
  "points": {
   "Barrel": [
    0.0,
    0.0233,
    0.6967
   ],
   "OpticAttachmentPoint": [
    0.0,
    0.062,
    -0.034
   ],
   "LaserAttachmentPoint": [
    0.0,
    -0.0048,
    0.3626
   ],
   "GripAttachmentPoint": [
    0.0,
    -0.0048,
    0.274
   ]
  }
 },
 "G17": {
  "Name": "Glock G17",
  "HipPositionalOffset": [
   0.037,
   -0.06,
   0.257
  ],
  "HipRotationalOffset": [
   0.0,
   180.0,
   0.0
  ],
  "AimPositionalOffset": [
   0.0,
   -0.043,
   0.25
  ],
  "AimRotationalOffset": [
   0.0,
   180.0,
   0.0
  ],
  "NetworkPositionalOffset": [
   0.168,
   0.0,
   0.361
  ],
  "NetworkRotationalOffset": [
   0.0,
   0.0,
   0.0
  ],
  "HipAimSpring": 600.0,
  "HipAimDrag": 25.0,
  "Damage": 20.0,
  "DamageMultiplierPerMeter": 0.9,
  "Range": 70.0,
  "SpreadAngleIncreasePerShot": 4.0,
  "SpreadAngleReductionPerSecond": 12.0,
  "MaxShootSpreadAngle": 8.0,
  "MovementSpreadAngleMultiplier": 1.0,
  "Rpm": 600.0,
  "ShootingType": 1,
  "MaxAmmo": 10,
  "Ammo": 30,
  "MaxStoredAmmo": 100,
  "StoredAmmo": 30,
  "ReloadTime": 1.0,
  "SwayMultiplier": 2.0,
  "SwaySpring": 100.0,
  "SwayDrag": 10.0,
  "MaxMouseDelta": 5.0,
  "BobSpeedThreshold": 1.0,
  "BobStepMultiplier": 0.025,
  "BobMultiplier": [
   0.25,
   0.5,
   0.25
  ],
  "BobSpring": 150.0,
  "BobDrag": 10.0,
  "VisualPositionalRecoil": [
   0.0,
   0.0,
   -0.35
  ],
  "VisualPositionalRecoilSpring": 150.0,
  "VisualPositionalRecoilDrag": 10.0,
  "VisualRotationalRecoil": [
   50.0,
   25.0,
   0.0
  ],
  "VisualRotationalRecoilSpring": 200.0,
  "VisualRotationalRecoilDrag": 10.0,
  "Recoil": [
   -12.0,
   7.0
  ],
  "recoilDrag": 10.0,
  "FovLerpSpeed": 15.0,
  "Optics": [
   "NoOptic",
   "RedDotSight",
   "Holosight",
   "SniperScope"
  ],
  "Lasers": [
   "NoLaser",
   "RedLaser",
   "GreenLaser"
  ],
  "Grips": [
   "NoGrip",
   "HollowLongGrip",
   "HollowShortGrip",
   "VerticalGrip"
  ],
  "GunshotVolume": 0.8,
  "GunshotPitch": 1.1,
  "GunshotPitchVariance": 0.1,
  "AmmoToIncreaseGunshotPitch": 5,
  "LowAmmoAdditionalPitch": 0.5,
  "model": "gun_g17",
  "icon": "pistol_02",
  "useMount": true,
  "points": {
   "Barrel": [
    0.0,
    0.0264,
    0.1118
   ],
   "OpticAttachmentPoint": [
    0.0,
    0.0385,
    0.0413
   ],
   "LaserAttachmentPoint": [
    0.0,
    -0.0014,
    0.0859
   ],
   "GripAttachmentPoint": [
    0.0,
    -0.0014,
    0.0558
   ]
  }
 },
 "P90": {
  "Name": "FN P90",
  "HipPositionalOffset": [
   0.065,
   -0.074,
   0.2659
  ],
  "HipRotationalOffset": [
   1.9479,
   174.1056,
   -0.2011
  ],
  "AimPositionalOffset": [
   0.0,
   -0.099,
   0.176
  ],
  "AimRotationalOffset": [
   0.0,
   180.0,
   0.0
  ],
  "NetworkPositionalOffset": [
   0.181,
   -0.074,
   0.4711
  ],
  "NetworkRotationalOffset": [
   0.0,
   0.0,
   0.0
  ],
  "HipAimSpring": 500.0,
  "HipAimDrag": 25.0,
  "Damage": 15.0,
  "DamageMultiplierPerMeter": 0.9,
  "Range": 70.0,
  "SpreadAngleIncreasePerShot": 4.0,
  "SpreadAngleReductionPerSecond": 8.5,
  "MaxShootSpreadAngle": 12.0,
  "MovementSpreadAngleMultiplier": 1.0,
  "Rpm": 850.0,
  "ShootingType": 0,
  "MaxAmmo": 50,
  "Ammo": 30,
  "MaxStoredAmmo": 500,
  "StoredAmmo": 30,
  "ReloadTime": 1.5,
  "SwayMultiplier": 3.0,
  "SwaySpring": 100.0,
  "SwayDrag": 10.0,
  "MaxMouseDelta": 5.0,
  "BobSpeedThreshold": 1.0,
  "BobStepMultiplier": 0.025,
  "BobMultiplier": [
   0.25,
   0.5,
   0.25
  ],
  "BobSpring": 100.0,
  "BobDrag": 10.0,
  "VisualPositionalRecoil": [
   0.0,
   0.0,
   -0.45
  ],
  "VisualPositionalRecoilSpring": 200.0,
  "VisualPositionalRecoilDrag": 10.0,
  "VisualRotationalRecoil": [
   22.5,
   18.0,
   0.0
  ],
  "VisualRotationalRecoilSpring": 200.0,
  "VisualRotationalRecoilDrag": 10.0,
  "Recoil": [
   -10.0,
   8.0
  ],
  "recoilDrag": 10.0,
  "FovLerpSpeed": 10.0,
  "Optics": [
   "NoOptic",
   "RedDotSight",
   "Holosight",
   "SniperScope"
  ],
  "Lasers": [
   "NoLaser",
   "RedLaser",
   "GreenLaser"
  ],
  "Grips": [
   "NoGrip"
  ],
  "GunshotVolume": 0.9,
  "GunshotPitch": 1.2,
  "GunshotPitchVariance": 0.1,
  "AmmoToIncreaseGunshotPitch": 3,
  "LowAmmoAdditionalPitch": 0.5,
  "model": "gun_p90",
  "icon": "smg_08",
  "useMount": false,
  "points": {
   "Barrel": [
    0.0,
    0.0,
    0.281
   ],
   "OpticAttachmentPoint": [
    0.0,
    0.106,
    0.157
   ],
   "LaserAttachmentPoint": [
    -0.027,
    0.077,
    0.154
   ]
  }
 }
};
export const ATTACHMENTS = {
 "HollowLongGrip": {
  "name": "Hollow Long",
  "type": "grip",
  "model": "att_grip_hl",
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0338,
   0.0056
  ],
  "reticle": null,
  "laserOrigin": null
 },
 "HollowShortGrip": {
  "name": "Hollow Short",
  "type": "grip",
  "model": "att_grip_hs",
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0338,
   0.0056
  ],
  "reticle": null,
  "laserOrigin": null
 },
 "NoGrip": {
  "name": "None",
  "type": "grip",
  "model": null,
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 1.0,
  "point": [
   0,
   0,
   0
  ],
  "reticle": null,
  "laserOrigin": null
 },
 "VerticalGrip": {
  "name": "Vertical",
  "type": "grip",
  "model": "att_grip_v",
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0,
   0.0
  ],
  "reticle": null,
  "laserOrigin": null
 },
 "GreenLaser": {
  "name": "Laser (Green)",
  "type": "laser",
  "model": "att_laser",
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   0.0,
   1,
   0.2966
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0112,
   0.0
  ],
  "reticle": null,
  "laserOrigin": [
   -0.0163,
   0.0,
   0.0409
  ]
 },
 "NoLaser": {
  "name": "None",
  "type": "laser",
  "model": null,
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0,
   0,
   0
  ],
  "reticle": null,
  "laserOrigin": null
 },
 "RedLaser": {
  "name": "Laser (Red)",
  "type": "laser",
  "model": "att_laser",
  "preferredDist": 1.0,
  "aimMult": 0.25,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0112,
   0.0
  ],
  "reticle": null,
  "laserOrigin": [
   -0.0163,
   0.0,
   0.0409
  ]
 },
 "Holosight": {
  "name": "Holosight",
  "type": "optic",
  "model": "att_holo",
  "preferredDist": 0.175,
  "aimMult": 0.15,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0,
   0.0072
  ],
  "reticle": [
   0.0,
   0.0262,
   0.0
  ],
  "laserOrigin": null
 },
 "NoOptic": {
  "name": "None",
  "type": "optic",
  "model": null,
  "preferredDist": 0.0,
  "aimMult": 0.25,
  "aimFovMult": 0.85,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0,
   0,
   0
  ],
  "reticle": null,
  "laserOrigin": null
 },
 "RedDotSight": {
  "name": "Red Dot Sight",
  "type": "optic",
  "model": "att_reddot",
  "preferredDist": 0.175,
  "aimMult": 0.15,
  "aimFovMult": 0.8,
  "hasScope": false,
  "scopeFov": 30.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   0.0,
   0.0
  ],
  "reticle": [
   0.0,
   0.0395,
   0.0
  ],
  "laserOrigin": null
 },
 "SniperScope": {
  "name": "Scope",
  "type": "optic",
  "model": "att_scope",
  "preferredDist": 0.25,
  "aimMult": 0.1,
  "aimFovMult": 0.6,
  "hasScope": true,
  "scopeFov": 5.0,
  "laserColor": [
   1,
   0.0,
   0.0
  ],
  "laserRange": 10.0,
  "gripRecoil": 0.75,
  "point": [
   0.0,
   -0.0334,
   -0.0091
  ],
  "reticle": [
   0.0,
   0.0,
   0.0
  ],
  "laserOrigin": null
 }
};
export const LOADOUTS = [
 {
  "name": "Agile",
  "speedMult": 1.2,
  "jumpMult": 1.15,
  "primary": "P90",
  "secondary": "G17",
  "grenade": "flash",
  "grenadeCount": 2
 },
 {
  "name": "Assault",
  "speedMult": 1.0,
  "jumpMult": 1.0,
  "primary": "AK12",
  "secondary": "G17",
  "grenade": "explosive",
  "grenadeCount": 2
 },
 {
  "name": "Ranged",
  "speedMult": 1.0,
  "jumpMult": 1.0,
  "primary": "BT .50 Cal",
  "secondary": "G17",
  "grenade": "explosive",
  "grenadeCount": 2
 }
];
export const MOUNT = { gunPoint: [0.0, 0.0431, 0.0], opticPoint: [0.0, 0.0482, 0.0] };
export const GRENADES = {
  explosive: { name: 'Frag Grenade', model: 'gren_explosive', icon: 'explosive_grenade', range: 5, fuse: 2, damage: 150, sticky: false },
  flash:     { name: 'Flash Grenade', model: 'gren_flash', icon: 'flash_grenade', range: 5, fuse: 2, maxFlash: 2, flash: true },
  sticky:    { name: 'Sticky Grenade', model: 'gren_sticky', icon: 'sticky_grenade', range: 5, fuse: 3, damage: 150, sticky: true },
};
export const PLAYER = {
  maxHealth: 100, walkAccel: 20, sprintAccel: 40, crouchAccel: 10, proneAccel: 5, drag: 6, jumpForce: 7,
  height: 2.0, crouchHeight: 1.5, proneHeight: 1.0, radius: 0.35,
  respawnInvincibility: 3, killBelowY: -100, throwForce: 10, throwAngleOffset: -10,
};
export const SPAWNS = [[0.0, -3.8, 0.0], [0.0, 1.3, -38.01], [0.0, 1.17, 41.19]];
export const ELEVATOR = { x: -10, z: 0, halfX: 2, halfZ: 1.85, bottom: -5.0, top: 5.0, wait: 1.0, travel: 4.0, platformTopLocal: 1.4665 };
