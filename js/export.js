// Builds the downloadable Minecraft Bedrock packs with JSZip (loaded globally).
import { VILLAGER_BONES } from './model.js';
import { rgbToHex } from './paint.js';

const uuid = () => crypto.randomUUID();
const json = o => JSON.stringify(o, null, 2);
const ENGINE = [1, 20, 0];

export function slugify(name) {
  return (name || 'villager').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'villager';
}

export function canvasBlob(canvas) {
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function manifest(name, description, type, deps = []) {
  return {
    format_version: 2,
    header: { name, description, uuid: uuid(), version: [1, 0, 0], min_engine_version: ENGINE },
    modules: [{ type, uuid: uuid(), version: [1, 0, 0] }],
    ...(deps.length ? { dependencies: deps } : {}),
  };
}

// 1. Resource pack that gives every villager the new face.
export async function villagerTexturePack(texture, icon, name) {
  const zip = new JSZip();
  zip.file('manifest.json', json(manifest(`${name}'s Villagers`, 'Every villager looks like you. Made with Villagerify.', 'resources')));
  zip.file('pack_icon.png', icon);
  zip.file('textures/entity/villager2/villager.png', texture);
  zip.file('textures/entity/villager/villager.png', texture);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}

// 1b. Real villager variant: vanilla villagers already pick one of six skin slots
// (skin_id 0-5) at random, and every slot uses the same texture. This points
// `slots` of them at the new face, so real villagers (trading, professions,
// breeding) sometimes spawn looking like you. Resource pack only.
export async function villagerVariantPack(texture, icon, name, slots) {
  const entity = await (await fetch('vanilla/villager_v2.entity.json')).json();
  const keys = ['base6', 'base5', 'base4', 'base3', 'base2'].slice(0, slots);
  const slug = slugify(name);
  for (const k of keys) entity['minecraft:client_entity'].description.textures[k] = `textures/entity/villagerify/${slug}_variant`;
  const zip = new JSZip();
  zip.file('manifest.json', json(manifest(`${name} Villager Variant`, `About ${slots} in 6 villagers look like you. Made with Villagerify.`, 'resources')));
  zip.file('pack_icon.png', icon);
  zip.file('entity/villager_v2.entity.json', json(entity));
  zip.file(`textures/entity/villagerify/${slug}_variant.png`, texture);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}

// 2. Skin pack with one free skin.
export async function skinPack(skin, name) {
  const zip = new JSZip();
  const m = manifest(`${name} Villager Skin`, 'Made with Villagerify.', 'skin_pack');
  delete m.header.min_engine_version;
  zip.file('manifest.json', json(m));
  zip.file('skins.json', json({
    skins: [{ localization_name: 'villager', geometry: 'geometry.humanoid.custom', texture: 'villager.png', type: 'free' }],
    serialize_name: 'Villagerify', localization_name: 'Villagerify',
  }));
  zip.file('texts/en_US.lang', `skinpack.Villagerify=Villagerify\nskin.Villagerify.villager=${name} the Villager\n`);
  zip.file('texts/languages.json', json(['en_US']));
  zip.file('villager.png', skin);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}

// 3. Add-on with a custom villager mob and its own spawn egg.
export async function villagerAddon(texture, icon, name, features) {
  const slug = slugify(name);
  const id = `villagerify:${slug}`;
  const geo = `geometry.villagerify.${slug}`;
  const rp = manifest(`${name} Villager (resources)`, 'A custom villager made with Villagerify.', 'resources');
  const bp = manifest(`${name} Villager`, 'A custom villager made with Villagerify.', 'data',
    [{ uuid: rp.header.uuid, version: rp.header.version }]);

  const zip = new JSZip();
  const R = zip.folder(`${slug}_RP`);
  const B = zip.folder(`${slug}_BP`);

  R.file('manifest.json', json(rp));
  R.file('pack_icon.png', icon);
  R.file(`textures/entity/villagerify/${slug}.png`, texture);
  R.file(`models/entity/villagerify_${slug}.geo.json`, json({
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: {
        identifier: geo, texture_width: 64, texture_height: 64,
        visible_bounds_width: 2, visible_bounds_height: 3, visible_bounds_offset: [0, 1.5, 0],
      },
      bones: VILLAGER_BONES.map(b => ({
        name: b.name,
        ...(b.parent ? { parent: b.parent } : {}),
        pivot: b.pivot,
        ...(b.rotation ? { rotation: b.rotation } : {}),
        cubes: b.cubes.map(c => ({
          origin: c.origin, size: c.size, uv: c.uv,
          ...(c.inflate ? { inflate: c.inflate } : {}),
          ...(c.mirror ? { mirror: true } : {}),
        })),
      })),
    }],
  }));
  R.file(`animations/villagerify_${slug}.animation.json`, json({
    format_version: '1.8.0',
    animations: {
      [`animation.villagerify.${slug}.walk`]: {
        loop: true,
        bones: {
          leg0: { rotation: ['math.cos(query.modified_distance_moved * 38.17) * 40.0 * query.modified_move_speed', 0, 0] },
          leg1: { rotation: ['-math.cos(query.modified_distance_moved * 38.17) * 40.0 * query.modified_move_speed', 0, 0] },
        },
      },
      [`animation.villagerify.${slug}.look`]: {
        loop: true,
        bones: { head: { relative_to: { rotation: 'entity' }, rotation: ['query.target_x_rotation', 'query.target_y_rotation', 0] } },
      },
    },
  }));
  R.file(`entity/villagerify_${slug}.entity.json`, json({
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: id,
        materials: { default: 'entity_alphatest' },
        textures: { default: `textures/entity/villagerify/${slug}` },
        geometry: { default: geo },
        animations: { walk: `animation.villagerify.${slug}.walk`, look: `animation.villagerify.${slug}.look` },
        scripts: { animate: ['walk', 'look'] },
        render_controllers: ['controller.render.default'],
        spawn_egg: { base_color: rgbToHex(features.robe), overlay_color: rgbToHex(features.skin) },
      },
    },
  }));
  R.file('sounds.json', json({
    entity_sounds: {
      entities: {
        [id]: {
          volume: 1, pitch: [0.8, 1.2],
          events: { ambient: 'mob.villager.idle', hurt: 'mob.villager.hit', death: 'mob.villager.death' },
        },
      },
    },
  }));
  const lang = `entity.${id}.name=${name}\nitem.spawn_egg.entity.${id}.name=Spawn ${name}\n`;
  R.file('texts/en_US.lang', lang);
  R.file('texts/languages.json', json(['en_US']));

  B.file('manifest.json', json(bp));
  B.file('pack_icon.png', icon);
  B.file(`entities/villagerify_${slug}.json`, json({
    format_version: '1.20.0',
    'minecraft:entity': {
      description: { identifier: id, is_spawnable: true, is_summonable: true, is_experimental: false },
      components: {
        'minecraft:type_family': { family: ['villagerify', 'mob'] },
        'minecraft:health': { value: 20, max: 20 },
        'minecraft:collision_box': { width: 0.6, height: 1.95 },
        'minecraft:movement': { value: 0.5 },
        'minecraft:movement.basic': {},
        'minecraft:navigation.walk': { can_path_over_water: false, avoid_water: true, can_open_doors: true },
        'minecraft:jump.static': {},
        'minecraft:can_climb': {},
        'minecraft:physics': {},
        'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
        'minecraft:nameable': {},
        'minecraft:persistent': {},
        'minecraft:leashable': { soft_distance: 4, hard_distance: 6, max_distance: 10 },
        'minecraft:ambient_sound_interval': { value: 8, range: 16, event_name: 'ambient' },
        'minecraft:behavior.float': { priority: 0 },
        'minecraft:behavior.panic': { priority: 1, speed_multiplier: 1.2 },
        'minecraft:behavior.random_stroll': { priority: 6, speed_multiplier: 0.6 },
        'minecraft:behavior.look_at_player': { priority: 7, look_distance: 8, probability: 0.02 },
        'minecraft:behavior.random_look_around': { priority: 8 },
        'minecraft:conditional_bandwidth_optimization': {},
      },
    },
  }));
  B.file('texts/en_US.lang', lang);
  B.file('texts/languages.json', json(['en_US']));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}
