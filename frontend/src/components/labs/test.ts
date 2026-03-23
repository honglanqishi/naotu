const counts = [1000]
let subCount = counts.length / 100;
let isxunhuan = true
let index = 0
while (isxunhuan) {
    let req = counts.splice(index, 100)
    let ddd = async () => {
        await Promise.all(req).then(() => {
            //..业务代码处理逻辑
            return new Promise((res, rej) => {
                rej()
            })
        })
        index++
        ddd()
    }
    if (index = 0) {
        ddd()
    }
}





