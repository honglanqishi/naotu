interface Animal { kind: string }
interface Cat extends Animal { meow(): void }

const cats: Cat[] = [{ kind: "cat", meow() {} }, ...];

// 协变： Cat[] 可以直接当 Animal[] 用（只读情况下安全）
const animals: readonly Animal[] = cats;           // ✓ 没问题

// 非常常见：你从后端拿到的具体类型列表，想当更宽泛类型用
function renderList(list: readonly Animal[]) {
  return list.map(a => <div>{a.kind}</div>);
}

renderList(cats);   // 非常自然