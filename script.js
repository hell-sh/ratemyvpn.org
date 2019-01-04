$("#noscript").addClass("uk-hidden");
$("[data-target]").on("click",function()
{
	setShown($(this).attr("data-target"));
});
var part=0,dns={},ipv4,ipv6,speed={},results={},
setShown=target=>{
	$("#container > div").addClass("uk-hidden");
	$("#"+target).removeClass("uk-hidden");
},
setFailed=()=>{
	if(part == 0)
	{
		setShown("disconnect-prompt");
	}
	else
	{
		setShown("connect-prompt");
	}
	UIkit.notification({status: "danger", message: "An error occured. Please try again." });
},
collectInfo=()=>{
	setShown("collecting-info");
	$("#info-progress").val(0);
	dns[part]=[];
	var sent=0,failed=0;
	for(var i = 0; i < 100; i++)
	{
		var token = "";
		for(var j = 0; j < 40; j++)
		{
			token += "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36));
		}
		$.ajax({
			type: "GET",
			url: "https://" + token + ".ipleak.net/dnsdetect/",
			cache: false
		}).done(data=>{
			if(dns[part].indexOf(data) == -1)
			{
				dns[part].push(data);
			}
		}).fail(()=>{
			if(++failed == 20)
			{
				sent = -1;
				setFailed();
			}
		}).always(()=>{
			$("#info-progress").val(++sent / 102);
			if(sent == 100)
			{
				let continueWithSpeedtest=()=>{
					setShown("speedtest");
					var startTime;
					$("#speedtest-progress").val(0);
					$.ajax({
						type: "GET",
						url: "http://ratemyvpn.org/speedtest.png",
						cache: false,
						xhr: ()=>{
							var xhr = new XMLHttpRequest();
							xhr.addEventListener("progress",event=>{
								if(startTime==null)
								{
									startTime=(new Date()).getTime();
								}
								speed[part]=((event.loaded*8)/(((new Date()).getTime()-startTime)/1000));
								$("#speedtest-speed").text((speed[part]/1000000).toFixed(2));
								$("#speedtest-progress").val(event.loaded/event.total);
							});
							return xhr;
						}
					}).done(()=>{
						if(part == 0)
						{
							part = 1;
							setShown("connect-prompt");
						}
						else
						{
							generateResults();
						}
					}).fail(setFailed);
				},
				continueWithIpv6=()=>{
					$("#info-progress").val(101 / 102);
					if(part == 1 && ipv6 == null)
					{
						results[0].t -= 2;
						results[0].n.push("You don't seem to get IPv6 from your ISP, so your VPN wasn't tested in this regard.");
						continueWithSpeedtest();
					}
					else
					{
						$.ajax("https://ipv6.apimon.de/").done(i=>{
							if(part == 1)
							{
								if(ipv6 != i)
								{
									results[0].p += 2;
								}
								else
								{
									results[0].n.push("Your IPv6 address was not hidden.");
								}
							}
							else
							{
								ipv6 = i;
							}
							continueWithSpeedtest();
						}).fail(()=>$.ajax("http://[2a01:4f8:1c1c:a436::1]/").done(i=>{
							if(part == 1)
							{
								if(ipv6 != i)
								{
									results[0].p += 1;
								}
								else
								{
									results[0].n.push("Your IPv6 address not hidden, but AAAA records are not resolved.");
								}
							}
							else
							{
								ipv6 = i;
							}
							continueWithSpeedtest();
						}).fail(()=>{
							if(part == 1)
							{
								results[0].p += 1;
								results[0].n.push("IPv6 connections are completely denied. This is good for your privacy, but bad for your internet experience.");
							}
							else
							{
								ipv6 = null;
							}
							continueWithSpeedtest();
						}));
					}
				};
				if(part == 1)
				{
					results={0:{p:0,t:7,n:[]}};
				}
				if(part == 1 && ipv4 == null)
				{
					results[0].t -= 2;
					results[0].n.push("You don't seem to get IPv4 from your ISP, so your VPN wasn't tested in this regard.");
					continueWithIpv6();
				}
				else
				{
					$.ajax("https://ipv4.apimon.de/").done(i=>{
						if(part == 1)
						{
							if(ipv4 != i)
							{
								results[0].p += 2;
							}
							else
							{
								results[0].n.push("Your IPv4 address was not hidden.");
							}
						}
						else
						{
							ipv4 = i;
						}
						continueWithIpv6();
					}).fail(()=>$.ajax("http://159.69.210.10/").done(i=>{
						if(part == 1)
						{
							if(ipv4 != i)
							{
								results[0].p += 1;
							}
							else
							{
								results[0].n.push("Your IPv4 address was not hidden, but A records are not resolved.");
							}
						}
						else
						{
							ipv4 = i;
						}
						continueWithIpv6();
					}).fail(()=>{
						if(part == 1)
						{
							results[0].p += 1;
							results[0].n.push("IPv4 connections are completely denied. This is good for your privacy, but bad for your internet experience.");
						}
						else
						{
							ipv4 = null;
						}
						continueWithIpv6();
					}));
				}
			}
		});
	}
},
generateResults=()=>{
	setShown("generating-results");
	var points=0,total=0,index=["Privacy","Speed"],
	dnsleaks=[],dnsreq=0,dnsres=0,
	speedperc=((100 / speed[0]) * speed[1]),speedscore,
	renderResults=()=>{
		if(dnsleaks.length == 0)
		{
			results[0].p += 3;
		}
		$("#results-grid").html("");
		for(var i in results)
		{
			points += results[i].p;
			total += results[i].t;
			var scoreperc = ((results[i].p / results[i].t) * 100), div = document.createElement("div"), html = '<div class="uk-card uk-card-default uk-card-body"><h3 class="uk-card-title">' + index[i], type = "danger";
			if(scoreperc > 75)
			{
				type = "success";
			}
			else if(scoreperc > 25)
			{
				type = "warning";
			}
			html += ' <span class="uk-label uk-label-' + type + ' uk-padding-small">' + results[i].p + "/" + results[i].t + '</span></h3>';
			if("n" in results[i] && results[i].n.length > 0)
			{
				if(results[i].n.length > 1)
				{
					html += '<ul>';
					results[i].n.forEach(n=>html+='<li>'+n+'</li>');
					html += '</ul>';
				}
				else
				{
					html += '<p>' + results[i].n[0] + '</p>';
				}
			}
			else
			{
				html += '<p>Perfect!</p>';
			}
			div.innerHTML = html + '</div>';
			$("#results-grid").append(div);
		}
		$("#results-points").text(points + "/" + total);
		setShown("results");
	};
	if(speedperc > 100)
	{
		speedperc = 100;
	}
	speedscore=(Math.ceil((speedperc / 100) * 8) - 5);
	if(speedscore < 0)
	{
		speedscore = 0;
	}
	results[1] = {
		p: speedscore,
		t: 3,
		n: ["Your tunneled speed is ~" + speedperc.toFixed(2) + "% of your normal speed."]
	};
	dns[0].forEach(i=>{
		if(dns[1].indexOf(i) != -1)
		{
			dnsreq++;
			$.ajax("https://apimon.de/geoip/" + i).done(data=>{
				if(dnsleaks.indexOf(data.as_number) == -1)
				{
					dnsleaks.push(data.as_number);
				}
			}).always(()=>{
				dnsres++;
				$("#results-progress").val(dnsreq / dnsres);
				if(dnsres == dnsreq)
				{
					if(dnsleaks.length == 1 && (dnsleaks.indexOf("15169") != -1))
					{
						results[0].p += 2;
						results[0].n.push("Your VPN leaked your DNS servers but you seem to be using a public DNS server.");
					}
					else
					{
						dnsleaks.forEach(as=>results[0].n.push("DNS servers by AS" + as + " (probably your ISP) were leaked."));
					}
					renderResults();
				}
			});
		}
	});
	if(dnsreq == 0)
	{
		renderResults();
	}
};
