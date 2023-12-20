import "./style.css";
import Phaser from "phaser";

const TILE_SIZE = 18;
const WIDTH = 66 * TILE_SIZE;
const HEIGHT = 55 * TILE_SIZE;

const restartDialog = document.getElementById("restart-dialog");
const restartButton = document.getElementById("restart-button");
const scoreSpan = document.getElementById("score-span");

const PLAYER_ANIMS = {
  idle: "idle",
  walk: "walk",
  run: "run",
  jump: "jump",
  cheer: "cheer",
  fall: "fall",
};

const events = new Phaser.Events.EventEmitter();
const COIN_COLLECTED_EVENT = "coin-collected";

class UiScene extends Phaser.Scene {
  constructor() {
    super("ui-scene");

    this.scoreText;
  }

  preload() {
    this.load.image("coin-ui", "coin.png");
  }

  create() {
    let coin = this.add.image(32, 32, "coin-ui");
    coin.setScale(0.5);

    this.scoreText = this.add.text(55, 10, "0", {
      color: "#000",
      fontSize: 40,
      fontFamily: "fantasy, arial, sans-serif",
    });

    events.addListener(COIN_COLLECTED_EVENT, this.handleCoinCollected, this);
  }

  handleCoinCollected(score) {
    this.scoreText.setText(score);
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("main-scene");

    this.player;
    this.map;
    this.cursors;
    this.coins;

    this.coinNoise;
    this.jumpNoise;
    this.music;

    this.enemySpawnPoints = [];
    this.enemies;

    this.score = 0;
  }

  init() {
    this.scene.launch("ui-scene");
    this.score = 0;
  }

  preload() {
    this.load.atlas("robot", "robot.png", "robot.json");

    this.load.image("marble", "tilesets/marble.png");
    this.load.image("rock", "tilesets/rock.png");
    this.load.image("sand", "tilesets/sand.png");
    this.load.image("stone", "tilesets/stone.png");

    this.load.tilemapTiledJSON("map", "tilesets/map.json");

    this.load.image("coin", "coin.png");
    this.load.image("enemy", "spikeBall.png");
    this.load.audio("deathnoise", "coin.mp3");
    this.load.audio("coin-noise", "coin.mp3");
    this.load.audio("jump-noise", "jump.wav");
    this.load.audio("music", "Doomsday.mp3");
  }

  create() {
    let playerSpawn = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
    };

    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);

    this.coinNoise = this.sound.add("coin-noise");
    this.jumpNoise = this.sound.add("jump-noise", {
      volume: 0.5,
    });
    this.music = this.sound.add("music", {
      loop: true,
      volume: 0.5,
    });

    this.music.play();

    this.map = this.make.tilemap({ key: "map" });

    // object layer from Tiled
    const objectLayer = this.map.getObjectLayer("Objects");
    objectLayer.objects.forEach((o) => {
      const { x = 0, y = 0, name, width = 0, height = 0 } = o;
      switch (name) {
        case "player-spawn":
          playerSpawn.x = x + width / 2;
          playerSpawn.y = y + height / 2;
          break;
        case "enemy-spawn":
          this.enemySpawnPoints.push({
            x: x + width / 2,
            y: y + height / 2,
          });
          break;
      }
    });

    //console.log(this.enemySpawnPoints);

    const marbleTiles = this.map.addTilesetImage("marble", "marble");
    const rockTiles = this.map.addTilesetImage("rock", "rock");
    const sandTiles = this.map.addTilesetImage("sand", "sand");
    const stoneTiles = this.map.addTilesetImage("stone", "stone");

    this.map.createLayer(
      "Background",
      [marbleTiles, rockTiles, sandTiles, stoneTiles],
      0,
      0
    );

    const platformLayer = this.map.createLayer(
      "Platforms",
      [marbleTiles, rockTiles, sandTiles, stoneTiles],
      0,
      0
    );
    platformLayer.setCollisionByProperty({ collides: true });

    this.coins = this.physics.add.group({
      key: "coin",
      quantity: 12,
      setXY: { x: TILE_SIZE * 4, y: 0, stepX: WIDTH / 11 },
      setScale: { x: 0.25, y: 0.25 },
    });

    this.coins.children.iterate((coin) => {
      coin
        .setCircle(40)
        .setCollideWorldBounds(true)
        .setBounce(Phaser.Math.FloatBetween(0.4, 0.8))
        .setVelocityX(Phaser.Math.FloatBetween(-10, 10));
    });

    this.physics.add.collider(this.coins, platformLayer);
    this.physics.add.collider(this.coins, this.coins);

    this.player = this.physics.add.sprite(
      playerSpawn.x,
      playerSpawn.y,
      "robot",
      "character_robot_idle.png"
    );

    this.physics.add.overlap(
      this.player,
      this.coins,
      this.collectCoin,
      undefined,
      this
    );

    this.physics.add.collider(this.player, platformLayer);

    this.player
      .setCollideWorldBounds(true)
      .setBounce(0.2)
      .setSize(TILE_SIZE * 2, TILE_SIZE * 4.5)
      .setScale(0.5)
      .setOffset(TILE_SIZE * 1.7, TILE_SIZE * 2.6);

    // single frame
    this.player.anims.create({
      key: PLAYER_ANIMS.idle,
      frames: [{ key: "robot", frame: "character_robot_idle.png" }],
    });

    this.player.anims.create({
      key: PLAYER_ANIMS.fall,
      frames: [{ key: "robot", frame: "character_robot_fall.png" }],
    });

    this.player.anims.create({
      key: PLAYER_ANIMS.jump,
      frames: [{ key: "robot", frame: "character_robot_jump.png" }],
    });

    // multiple frames
    this.player.anims.create({
      key: PLAYER_ANIMS.run,
      frames: this.player.anims.generateFrameNames("robot", {
        start: 0,
        end: 2,
        prefix: "character_robot_run",
        suffix: ".png",
      }),
      frameRate: 10, // frames per second
      repeat: -1, // infinite repeat
    });

    this.player.anims.create({
      key: PLAYER_ANIMS.walk,
      frames: this.player.anims.generateFrameNames("robot", {
        start: 0,
        end: 7,
        prefix: "character_robot_walk",
        suffix: ".png",
      }),
      frameRate: 10, // frames per second
      repeat: -1, // infinite repeat
    });
    this.player.anims.create({
      key: PLAYER_ANIMS.cheer,
      frames: this.player.anims.generateFrameNames("robot", {
        start: 0,
        end: 1,
        prefix: "character_robot_cheer",
        suffix: ".png",
      }),
      frameRate: 5, // frames per second
      repeat: -1, // infinite repeat
    });

    this.player.play(PLAYER_ANIMS.run);

    this.cursors = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      upArrow: Phaser.Input.Keyboard.KeyCodes.UP,
      up: Phaser.Input.Keyboard.KeyCodes.W,
    });

    this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT);
    this.cameras.main.startFollow(this.player);
    this.cameras.main.zoom = 3;

    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, platformLayer);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.enemies, this.coins);
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.hitPlayer,
      undefined,
      this
    );
  }

  update() {
    if (this.cursors.left.isDown || this.cursors.leftArrow.isDown) {
      this.player.setVelocityX(-150);
    } else if (this.cursors.right.isDown || this.cursors.rightArrow.isDown) {
      this.player.setVelocityX(150);
    } else {
      this.player.setVelocityX(0);
    }

    if (
      (this.cursors.up.isDown ||
        this.cursors.upArrow.isDown ||
        this.cursors.jump.isDown) &&
      this.player.body.onFloor()
    ) {
      this.jumpNoise.play();
      this.player.setVelocityY(-300);
    }

    let { x, y } = this.player.body.velocity;

    this.player.flipX = x < 0;

    if (this.player.body.onFloor()) {
      if (x === 0) {
        this.player.play(PLAYER_ANIMS.idle);
      } else {
        this.player.play(PLAYER_ANIMS.run, true);
      }
    } else {
      if (y < 0) {
        this.player.play(PLAYER_ANIMS.jump, true);
      } else {
        this.player.play(PLAYER_ANIMS.fall, true);
      }
    }
  }

  collectCoin(player, coin) {
    this.score++;
    events.emit(COIN_COLLECTED_EVENT, this.score);

    coin.disableBody(true, true);
    this.coinNoise.play();

    let spawn =
      this.enemySpawnPoints[
        Phaser.Math.Between(0, this.enemySpawnPoints.length - 1)
      ];
    let enemy = this.enemies.create(spawn.x, spawn.y, "enemy");
    enemy
      .setCollideWorldBounds(true)
      .setBounce(1)
      .setVelocity(Phaser.Math.FloatBetween(-200, 200), 20)
      .setCircle(60, 12, 14)
      .setScale(0.25);
  }

  hitPlayer(player, enemy) {
    this.physics.pause();
    this.player.setTint(0x0000bb); // light blue death color for Hawkin

    restartDialog.showModal();
  }
}

/** @type {Phaser.Types.Core.GameConfig} */
const config = {
  type: Phaser.WEBGL,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [MainScene, UiScene],
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 300 },
      //debug: true,
    },
  },
};

const game = new Phaser.Game(config);

restartButton.addEventListener("click", () => {
  game.scene.start("main-scene");
  restartDialog.close();
});
