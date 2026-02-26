const players = ['阿哲', '小泽', '康康', 'Rina', '墨鱼', '...'].join(' · ');

const roles = ['狼人 x3', '预言家 x1', '强盗 x1', '捣蛋鬼 x1', '村民 x10', '中心牌 x3'];

const voteCandidates = ['阿哲', '小泽', '康康', 'Rina'];

const resultRows = [
  { name: '阿哲', role: '村民' },
  { name: '小泽', role: '狼人' },
  { name: '康康', role: '强盗' },
];

export default function Home(): React.ReactElement {
  return (
    <main className="mobile-board">
      <section className="phone-screen" id="home">
        <div className="tag">首页</div>
        <h1>今晚谁是狼人？</h1>
        <p>输入昵称，3-20 人线下开玩。</p>
        <div className="panel">
          <label>昵称</label>
          <div className="input">例如：阿哲</div>
          <button className="btn primary" type="button">
            创建房间
          </button>
          <button className="btn ghost" type="button">
            加入房间
          </button>
        </div>
      </section>

      <section className="phone-screen" id="lobby">
        <div className="tag">大厅</div>
        <h2>房间 #7K9M</h2>
        <p>当前 12/20 人 | 任意玩家可开局</p>
        <div className="panel">
          <h3>玩家列表</h3>
          <div className="list">{players}</div>
          <h3>角色池</h3>
          <div className="chips">
            {roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>
          <button className="btn primary" type="button">
            开始本局
          </button>
        </div>
      </section>

      <section className="phone-screen" id="night">
        <div className="tag">夜晚阶段</div>
        <h2>你的身份：预言家</h2>
        <p>请选择操作，倒计时结束自动提交。</p>
        <div className="panel">
          <div className="timer">剩余 00:28</div>
          <button className="choice" type="button">
            查看玩家：小泽
          </button>
          <button className="choice" type="button">
            查看玩家：康康
          </button>
          <button className="choice" type="button">
            查看中心牌 A+B
          </button>
          <button className="btn primary" type="button">
            确认行动
          </button>
        </div>
      </section>

      <section className="phone-screen" id="vote">
        <div className="tag">投票阶段</div>
        <h2>请投票你认为的狼人</h2>
        <p>锁票前可改票。</p>
        <div className="panel">
          <div className="timer danger">剩余 00:14</div>
          <div className="grid2">
            {voteCandidates.map((candidate, index) => (
              <button className={`vote ${index === 0 ? 'active' : ''}`.trim()} key={candidate} type="button">
                {candidate}
              </button>
            ))}
          </div>
          <button className="btn primary" type="button">
            提交投票
          </button>
        </div>
      </section>

      <section className="phone-screen" id="result">
        <div className="tag">结算</div>
        <h2>村民阵营胜利</h2>
        <p>最高票：小泽（5 票）</p>
        <div className="panel">
          <h3>身份揭示</h3>
          {resultRows.map((row) => (
            <div className="result-item" key={row.name}>
              <strong>{row.name}</strong>
              <span>{row.role}</span>
            </div>
          ))}
          <button className="btn primary" type="button">
            再来一局
          </button>
          <button className="btn ghost" type="button">
            返回大厅改配置
          </button>
        </div>
      </section>
    </main>
  );
}
