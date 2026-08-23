using System;
using System.Collections.Generic;

namespace AbyssRelic.Core
{
    /// <summary>
    /// 属性（ダメージタイプ）。物理3種と属性4種。
    /// 「防御の抜け方」と「積む状態異常」で役割を分けている。
    /// </summary>
    public enum DamageType { Slash, Pierce, Blunt, Fire, Shock, Frost, Arcane }

    public enum StatusId { None, Bleed, Burn, Chill, Shock, Stagger }

    public readonly struct DamageTypeDef
    {
        public readonly DamageType Type;
        public readonly string Name;
        public readonly bool Physical;
        /// <summary>敵の防御による軽減をどれだけ無視するか（0..1）。属性は 1＝完全無視。</summary>
        public readonly float Penetration;
        public readonly StatusId Status;

        public DamageTypeDef(DamageType t, string name, bool phys, float pen, StatusId st)
        { Type = t; Name = name; Physical = phys; Penetration = pen; Status = st; }
    }

    public readonly struct StatusDef
    {
        public readonly StatusId Id;
        public readonly string Name, Description;
        public readonly float Duration;
        public StatusDef(StatusId id, string name, float dur, string desc)
        { Id = id; Name = name; Duration = dur; Description = desc; }
    }

    public static class Elements
    {
        public static readonly DamageTypeDef[] Types =
        {
            new DamageTypeDef(DamageType.Slash,  "斬撃", true,  0.00f, StatusId.Bleed),
            new DamageTypeDef(DamageType.Pierce, "刺突", true,  0.45f, StatusId.None),
            new DamageTypeDef(DamageType.Blunt,  "打撃", true,  0.15f, StatusId.Stagger),
            new DamageTypeDef(DamageType.Fire,   "炎",   false, 1f,    StatusId.Burn),
            new DamageTypeDef(DamageType.Shock,  "雷",   false, 1f,    StatusId.Shock),
            new DamageTypeDef(DamageType.Frost,  "冷気", false, 1f,    StatusId.Chill),
            new DamageTypeDef(DamageType.Arcane, "魔法", false, 1f,    StatusId.None),
        };

        public static readonly StatusDef[] Statuses =
        {
            new StatusDef(StatusId.Bleed,   "出血",     5.0f, "毎秒ダメージ（防御無視）"),
            new StatusDef(StatusId.Burn,    "火傷",     4.0f, "毎秒ダメージ"),
            new StatusDef(StatusId.Chill,   "凍傷",     4.0f, "移動・攻撃速度 -35%"),
            new StatusDef(StatusId.Shock,   "感電",     5.0f, "被ダメージ +25%"),
            new StatusDef(StatusId.Stagger, "よろめき", 1.1f, "行動が止まる"),
        };

        public const float ChillSlow = 0.35f;
        public const float ShockAmplify = 0.25f;

        public static DamageTypeDef Def(DamageType t) => Types[(int)t];
        public static StatusDef Def(StatusId s) => Array.Find(Statuses, x => x.Id == s);
    }

    /// <summary>耐性表。負の値が弱点。</summary>
    [Serializable]
    public class Resistances
    {
        readonly Dictionary<DamageType, float> _map = new Dictionary<DamageType, float>();

        public Resistances Set(DamageType t, float pct) { _map[t] = pct; return this; }
        public float Get(DamageType t)
            => Math.Clamp(_map.TryGetValue(t, out var v) ? v : 0f, -100f, 75f);

        public IEnumerable<DamageType> Weaknesses()
        { foreach (var kv in _map) if (kv.Value <= -15f) yield return kv.Key; }
        public IEnumerable<DamageType> Strengths()
        { foreach (var kv in _map) if (kv.Value >= 30f) yield return kv.Key; }
    }

    /// <summary>状態異常の現在値。蓄積(Buildup)と発症(Active)を分けて持つ。</summary>
    public class StatusHolder
    {
        public class Active { public float Remaining; public float Dps; public float Accum; }

        readonly Dictionary<StatusId, Active> _active = new Dictionary<StatusId, Active>();
        readonly Dictionary<StatusId, float> _buildup = new Dictionary<StatusId, float>();

        public bool Has(StatusId id) => _active.TryGetValue(id, out var a) && a.Remaining > 0f;
        public float Remaining(StatusId id) => _active.TryGetValue(id, out var a) ? a.Remaining : 0f;
        public IEnumerable<StatusId> ActiveIds() { foreach (var kv in _active) if (kv.Value.Remaining > 0f) yield return kv.Key; }
        public void Clear() { _active.Clear(); _buildup.Clear(); }

        public void Apply(StatusId id, float dps)
        {
            var def = Elements.Def(id);
            _active[id] = new Active { Remaining = def.Duration, Dps = dps };
        }

        /// <summary>蓄積を足し、閾値を超えたら発症させる。超えた分は繰り越さずリセット。</summary>
        public bool AddBuildup(StatusId id, float amount, float threshold, float dps)
        {
            float v = (_buildup.TryGetValue(id, out var b) ? b : 0f) + amount;
            if (v < threshold) { _buildup[id] = v; return false; }
            _buildup[id] = 0f;
            Apply(id, dps);
            return true;
        }

        /// <summary>時間経過。DoT は 1 以上たまった分だけ onDamage で返す。</summary>
        public void Tick(float dt, Action<int, StatusId> onDamage)
        {
            List<StatusId> expired = null;
            foreach (var kv in _active)
            {
                var a = kv.Value;
                if (a.Remaining <= 0f) continue;
                a.Remaining -= dt;

                if (kv.Key == StatusId.Burn || kv.Key == StatusId.Bleed)
                {
                    a.Accum += a.Dps * dt;
                    if (a.Accum >= 1f) { int d = (int)a.Accum; a.Accum -= d; onDamage?.Invoke(d, kv.Key); }
                }
                if (a.Remaining <= 0f) (expired ??= new List<StatusId>()).Add(kv.Key);
            }
            if (expired != null) foreach (var id in expired) _active.Remove(id);
        }
    }

    public struct DamagePart
    {
        public DamageType Type;
        public float Amount;
        public DamagePart(DamageType t, float a) { Type = t; Amount = a; }
    }

    public struct DamageResult
    {
        public int Total;
        public DamageType MainType;
        /// <summary>弱点を突いた／耐性で弾かれた。UI でそのまま見せる。</summary>
        public bool Weak, Resisted;
        public List<StatusId> Procs;
    }

    /// <summary>
    /// 属性ダメージの解決。
    /// 物理は防御で減り（Penetration のぶん抜ける）、属性は防御を無視して耐性だけで増減する。
    /// 状態異常は蓄積式 — 1発ごとの運任せだと「効いたのか分からない」ため。
    /// </summary>
    public static class ElementalCombat
    {
        public static float BuildupThreshold(bool isPlayer, int level)
            => isPlayer ? 34f + level * 4f : 20f + level * 5f;

        public static float StatusDps(bool isPlayer, int sourceLevel)
            => isPlayer ? 3f + sourceLevel * 1.1f : 6f + sourceLevel * 2.2f;

        public static DamageResult Resolve(GameRandom rng, IList<DamagePart> parts,
                                           Resistances res, float defense, int sourceLevel,
                                           StatusHolder status, bool targetIsPlayer,
                                           int targetLevel, bool noVariance = false)
        {
            float mitigation = defense / (defense + 50f + 10f * sourceLevel);
            float total = 0f, mainAmt = -1f;
            var main = DamageType.Slash;
            bool weak = false, resisted = false;
            var build = new Dictionary<StatusId, float>();

            foreach (var p in parts)
            {
                if (p.Amount <= 0f) continue;
                var d = Elements.Def(p.Type);
                float r = res?.Get(p.Type) ?? 0f;
                float amt = p.Amount * (1f - r / 100f);
                if (d.Physical) amt *= (1f - mitigation * (1f - d.Penetration));
                if (amt <= 0f) continue;

                if (r <= -15f) weak = true;
                if (r >= 30f) resisted = true;
                total += amt;
                if (amt > mainAmt) { mainAmt = amt; main = p.Type; }

                if (d.Status != StatusId.None)
                {
                    float b = amt * (d.Physical ? 0.55f : 1.35f);
                    build[d.Status] = (build.TryGetValue(d.Status, out var v) ? v : 0f) + b;
                }
            }

            if (status != null && status.Has(StatusId.Shock)) total *= (1f + Elements.ShockAmplify);
            total = Math.Max(1f, (int)(total * (noVariance ? 1f : rng.Range(0.92f, 1.08f))));

            var procs = new List<StatusId>();
            if (status != null)
            {
                float need = BuildupThreshold(targetIsPlayer, targetLevel);
                float dps = StatusDps(targetIsPlayer, sourceLevel);
                foreach (var kv in build)
                    if (status.AddBuildup(kv.Key, kv.Value, need, dps)) procs.Add(kv.Key);
            }

            return new DamageResult { Total = (int)total, MainType = main,
                                      Weak = weak, Resisted = resisted, Procs = procs };
        }
    }

    /// <summary>
    /// 敵の系統。形＝行動（アーキタイプ）、色＝属性（系統）で読ませる。
    /// 4アーキタイプ × 8系統 = 32通りが、この小さな表から出る。
    /// </summary>
    public class EnemyFamily
    {
        public string Id, Name;
        public UnityEngine.Color Color;
        public int MinDepth;
        public DamageType AttackType;
        public Resistances Res = new Resistances();

        static EnemyFamily Make(string id, string name, string hex, int minDepth,
                                DamageType atk, params (DamageType, float)[] res)
        {
            UnityEngine.ColorUtility.TryParseHtmlString(hex, out var c);
            var f = new EnemyFamily { Id = id, Name = name, Color = c,
                                      MinDepth = minDepth, AttackType = atk };
            foreach (var (t, v) in res) f.Res.Set(t, v);
            return f;
        }

        public static readonly EnemyFamily[] All =
        {
            Make("beast", "獣",   "#b5563f", 1,  DamageType.Slash),
            Make("undead","屍骸", "#b9b3a0", 4,  DamageType.Slash,
                 (DamageType.Slash, 40f), (DamageType.Blunt, -35f),
                 (DamageType.Frost, 30f), (DamageType.Fire, -20f)),
            Make("slime", "粘体", "#6f9a4a", 7,  DamageType.Blunt,
                 (DamageType.Pierce, 55f), (DamageType.Slash, -25f),
                 (DamageType.Fire, -30f), (DamageType.Shock, 25f)),
            Make("armor", "甲殻", "#7d8794", 11, DamageType.Pierce,
                 (DamageType.Slash, 35f), (DamageType.Pierce, 30f),
                 (DamageType.Blunt, -40f), (DamageType.Shock, -25f)),
            Make("flame", "焔鬼", "#e06a35", 15, DamageType.Fire,
                 (DamageType.Fire, 75f), (DamageType.Frost, -50f)),
            Make("frost", "氷霊", "#5fb8e0", 19, DamageType.Frost,
                 (DamageType.Frost, 75f), (DamageType.Fire, -50f)),
            Make("storm", "雷獣", "#e0c040", 24, DamageType.Shock,
                 (DamageType.Shock, 75f), (DamageType.Blunt, -25f)),
            Make("arcane","魔導", "#a97fe0", 30, DamageType.Arcane,
                 (DamageType.Arcane, 45f), (DamageType.Slash, -10f),
                 (DamageType.Pierce, -10f), (DamageType.Blunt, -10f)),
        };

        /// <summary>その階層までに解禁されている系統。</summary>
        public static List<EnemyFamily> Available(int depth)
        {
            var list = new List<EnemyFamily>();
            foreach (var f in All) if (f.MinDepth <= depth) list.Add(f);
            if (list.Count == 0) list.Add(All[0]);
            return list;
        }

        /// <summary>
        /// 1 階層に「同時に」出せる系統の数。
        /// 解禁済みを全部混ぜると序盤から色とりどりの敵が並び、
        /// 何に何が効くのか学習できない。絞ることで
        /// 「今回は屍骸の階」とフロア単位で読めるようになる。
        /// </summary>
        public static int SlotsAt(int depth) => Math.Clamp(1 + (depth - 1) / 9, 1, 4);

        /// <summary>
        /// その階層に出る系統を決める。解禁が新しい系統ほど重みを上げ、
        /// 深層で古い系統ばかり出続けるのを防ぐ。
        /// </summary>
        public static List<EnemyFamily> ForFloor(GameRandom rng, int depth)
        {
            var avail = Available(depth);
            int slots = Math.Min(SlotsAt(depth), avail.Count);
            // 層（10階層ごと）の相性を掛ける。灼熱の窯なら焔鬼が出やすい、というように、
            // 見た目の雰囲気と出る敵を一致させる。
            // 解禁そのものは動かさないので「序盤に属性の敵が出ない」という約束は壊れない。
            var zone = Zones.At(depth);
            var weights = new List<float>(avail.Count);
            foreach (var f in avail) weights.Add((1f + f.MinDepth * 0.12f) * zone.BiasFor(f.Id));

            var chosen = new List<EnemyFamily>(slots);
            for (int i = 0; i < slots && avail.Count > 0; i++)
            {
                float tot = 0f;
                foreach (var w in weights) tot += w;
                float x = rng.Next01() * tot;
                int k = avail.Count - 1;
                for (int j = 0; j < avail.Count; j++) { x -= weights[j]; if (x <= 0f) { k = j; break; } }
                chosen.Add(avail[k]);
                avail.RemoveAt(k); weights.RemoveAt(k);
            }
            return chosen;
        }
    }
}
