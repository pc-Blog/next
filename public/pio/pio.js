/* ----
# Pio Plugin
# By: Dreamer-Paul
# Modify: journey-ad
# Last Update: 2021.5.4

一个支持更换 Live2D 模型的 Typecho 插件。

本代码为奇趣保罗原创，并遵守 GPL 2.0 开源协议。欢迎访问我的博客：https://paugram.com

---- */

// ========== 修复：预先定义 toggleNightMode 函数 ==========
window.toggleNightMode = window.toggleNightMode || function() {
    var darkBtn = document.getElementById('fabtn_toggle_darkmode');
    if (darkBtn) {
        darkBtn.click();
        console.log('[Pio] 夜间模式已切换');
    } else {
        console.warn('[Pio] 找不到暗色模式按钮 #fabtn_toggle_darkmode');
        // 降级方案：直接操作 body 类名
        if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
            document.documentElement.classList.remove('dark');
        } else {
            document.body.classList.add('dark');
            document.documentElement.classList.add('dark');
        }
    }
};
// ========== 修复代码结束 ==========

var Paul_Pio = function (prop) {
    var that = this;

    var current = {
        idol: 0,
        menu: document.querySelector(".pio-container .pio-action"),
        canvas: document.getElementById("pio"),
        body: document.querySelector(".pio-container"),
        root: document.location.protocol + '//' + document.location.host + '/'
    };

    // ========== 修复：如果菜单容器不存在，动态创建 ==========
    if (!current.menu && current.body) {
        current.menu = document.createElement("div");
        current.menu.className = "pio-action";
        current.body.appendChild(current.menu);
        console.log('[Pio] 已动态创建 .pio-action 容器');
    }
    // ========== 修复代码结束 ==========

    /* - 方法 */
    var modules = {
        // 更换模型
        idol: function () {
            current.idol < (prop.model.length - 1) ? current.idol++ : current.idol = 0;
            return current.idol;
        },
        // 创建内容
        create: function (tag, prop) {
            var e = document.createElement(tag);
            if (prop.class) e.className = prop.class;
            return e;
        },
        // 随机内容
        rand: function (arr) {
            return arr[Math.floor(Math.random() * arr.length + 1) - 1];
        },
        // 创建对话框方法
        render: function (text) {
            if (text.constructor === Array) {
                dialog.innerHTML = modules.rand(text);
            }
            else if (text.constructor === String) {
                dialog.innerHTML = text;
            }
            else {
                dialog.innerHTML = "输入内容出现问题了 X_X";
            }

            dialog.classList.add("active");

            clearTimeout(this.t);
            this.t = setTimeout(function () {
                dialog.classList.remove("active");
            }, 6000);
        },
        // 移除方法
        destroy: function () {
            that.initHidden();
            localStorage.setItem("posterGirl", 0);
        },
        // 是否为移动设备
        isMobile: function () {
            var ua = window.navigator.userAgent.toLowerCase();
            ua = ua.indexOf("mobile") || ua.indexOf("android") || ua.indexOf("ios");

            return window.innerWidth < 500 || ua !== -1;
        }
    };
    this.modules = modules;
    this.destroy = modules.destroy;

    var elements = {
        home: modules.create("span", { class: "pio-home" }),
        skin: modules.create("span", { class: "pio-skin" }),
        info: modules.create("span", { class: "pio-info" }),
        night: modules.create("span", { class: "pio-night" })
        // close 和 show 按钮已移除
    };

    var dialog = modules.create("div", { class: "pio-dialog" });
    current.body.appendChild(dialog);
    // 移除了 elements.show 的添加

    /* - 提示操作 */
    var action = {
        // 欢迎
        welcome: function () {
            if (document.referrer !== "" && document.referrer.indexOf(current.root) === -1) {
                var referrer = document.createElement('a');
                referrer.href = document.referrer;
                prop.content.referer ? modules.render(prop.content.referer.replace(/%t/, "“" + referrer.hostname + "”")) : modules.render("欢迎来自 “" + referrer.hostname + "” 的朋友！");
            }
            else if (prop.tips) {
                var text, hour = new Date().getHours();

                if (hour > 22 || hour <= 5) {
                    text = '你是夜猫子呀？这么晚还不睡觉，明天起的来嘛';
                }
                else if (hour > 5 && hour <= 8) {
                    text = '早上好！';
                }
                else if (hour > 8 && hour <= 11) {
                    text = '上午好！工作顺利嘛，不要久坐，多起来走动走动哦！';
                }
                else if (hour > 11 && hour <= 14) {
                    text = '中午了，工作了一个上午，现在是午餐时间！';
                }
                else if (hour > 14 && hour <= 17) {
                    text = '午后很容易犯困呢，今天的运动目标完成了吗？';
                }
                else if (hour > 17 && hour <= 19) {
                    text = '傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红~';
                }
                else if (hour > 19 && hour <= 21) {
                    text = '晚上好，今天过得怎么样？';
                }
                else if (hour > 21 && hour <= 23) {
                    text = '已经这么晚了呀，早点休息吧，晚安~';
                }
                else {
                    text = "奇趣保罗说：这个是无法被触发的吧，哈哈";
                }

                modules.render(text);
            }
            else {
                modules.render(prop.content.welcome || "欢迎来到本站！");
            }
        },
        // 触摸
        touch: function () {
            current.canvas.onclick = function () {
                modules.render(prop.content.touch || ["你在干什么？", "再摸我就报警了！", "HENTAI!", "不可以这样欺负我啦！"]);
            };
        },
        // 右侧按钮
        buttons: function () {
            // ========== 修复：添加安全检查 ==========
            if (!current.menu) {
                console.warn('[Pio] 菜单容器不存在，跳过按钮初始化');
                return;
            }
            // ========== 修复代码结束 ==========
            
            // 返回首页
            elements.home.onclick = function () {
                location.href = current.root;
            };
            elements.home.onmouseover = function () {
                modules.render(prop.content.home || "点击这里回到首页！");
            };
            current.menu.appendChild(elements.home);

            // 更换模型
            elements.skin.onclick = function () {
                that.model = loadlive2d("pio", prop.model[modules.idol()], model => {
                    prop.onModelLoad && prop.onModelLoad(model)
                    prop.content.skin && prop.content.skin[1] ? modules.render(prop.content.skin[1]) : modules.render("新衣服真漂亮~");
                });
            };
            elements.skin.onmouseover = function () {
                prop.content.skin && prop.content.skin[0] ? modules.render(prop.content.skin[0]) : modules.render("想看看我的新衣服吗？");
            };
            if (prop.model.length > 1) current.menu.appendChild(elements.skin);

            // 关于我
            elements.info.onclick = function () {
                window.open(prop.content.link || "https://paugram.com/coding/add-poster-girl-with-plugin.html");
            };
            elements.info.onmouseover = function () {
                modules.render("想了解更多关于我的信息吗？");
            };
            current.menu.appendChild(elements.info);

            // 夜间模式
            if (prop.night) {
                elements.night.onclick = function () {
                    // 直接触发 Argon 的暗色模式按钮
                    var darkBtn = document.getElementById('fabtn_toggle_darkmode');
                    if (darkBtn) {
                        darkBtn.click();
                    } else if (typeof window.toggleNightMode === 'function') {
                        window.toggleNightMode();
                    } else {
                        try {
                            eval(prop.night);
                        } catch(e) {
                            console.warn('夜间模式切换失败', e);
                        }
                    }
                };
                elements.night.onmouseover = function () {
                    modules.render("夜间点击这里可以保护眼睛呢");
                };
                current.menu.appendChild(elements.night);
            }

            // 关闭看板娘按钮已移除，不再添加
        },
        custom: function () {
            if (prop.content.custom) {
                prop.content.custom.forEach(function (t) {
                    if (!t.type) t.type = "default";
                    var e = document.querySelectorAll(t.selector);

                    if (e.length) {
                        for (var j = 0; j < e.length; j++) {
                            if (t.type === "read") {
                                e[j].onmouseover = function () {
                                    modules.render("想阅读 %t 吗？".replace(/%t/, "“" + this.innerText + "”"));
                                }
                            }
                            else if (t.type === "link") {
                                e[j].onmouseover = function () {
                                    modules.render("想了解一下 %t 吗？".replace(/%t/, "“" + this.innerText + "”"));
                                }
                            }
                            else if (t.text) {
                                e[j].onmouseover = function () {
                                    modules.render(t.text);
                                }
                            }
                        }
                    }
                });
            }
        }
    };

    /* - 运行 */
    var begin = {
        static: function () {
            current.body.classList.add("static");
        },
        fixed: function () {
            action.touch(); action.buttons();
        },
        draggable: function () {
            action.touch(); action.buttons();

            var body = current.body;
            body.onmousedown = function (downEvent) {
                var location = {
                    x: downEvent.clientX - this.offsetLeft,
                    y: downEvent.clientY - this.offsetTop
                };

                function move(moveEvent) {
                    body.classList.add("active");
                    body.classList.remove("right");
                    body.style.left = (moveEvent.clientX - location.x) + 'px';
                    body.style.top = (moveEvent.clientY - location.y) + 'px';
                    body.style.bottom = "auto";
                }

                document.addEventListener("mousemove", move);
                document.addEventListener("mouseup", function () {
                    body.classList.remove("active");
                    document.removeEventListener("mousemove", move);
                });
            };
        }
    };

    // 运行
    this.init = function (onlyText) {
        if (!(prop.hidden && modules.isMobile())) {
            if (!onlyText) {
                action.welcome();
                that.model = loadlive2d("pio", prop.model[0], model => {
                    prop.onModelLoad && prop.onModelLoad(model)
                });
            }

            switch (prop.mode) {
                case "static": begin.static(); break;
                case "fixed": begin.fixed(); break;
                case "draggable": begin.draggable(); break;
            }

            if (prop.content.custom) action.custom();
        }
    };

    // 隐藏状态 - 完全移除隐藏功能，看板娘始终显示
    this.initHidden = function () {
        // 不再隐藏看板娘，直接初始化显示
        that.init();
    }

    // 检查 localStorage，如果标记为隐藏则忽略，始终显示
    if (localStorage.getItem("posterGirl") == 0) {
        // 即使之前隐藏过，现在也显示
        localStorage.setItem("posterGirl", 1);
        this.init();
    } else {
        this.init();
    }
};

// 请保留版权说明
if (window.console && window.console.log) {
    console.log("%c Pio %c https://paugram.com ", "color: #fff; margin: 1em 0; padding: 5px 0; background: #673ab7;", "margin: 1em 0; padding: 5px 0; background: #efefef;");
}

// 添加全局辅助函数，确保夜间模式切换正常工作
window.toggleNightMode = window.toggleNightMode || function() {
    var darkModeBtn = document.getElementById('fabtn_toggle_darkmode');
    if (darkModeBtn) {
        darkModeBtn.click();
    } else {
        console.warn('[Pio] 找不到暗色模式切换按钮 #fabtn_toggle_darkmode');
        var possibleBtns = document.querySelectorAll('[data-action="toggle-dark-mode"], .dark-mode-switch, #dark-mode-switch');
        if (possibleBtns.length > 0) {
            possibleBtns[0].click();
        }
    }
};