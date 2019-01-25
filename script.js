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
					var startTime,finished=false;
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
								var runtime=(((new Date()).getTime()-startTime)/1000);
								speed[part]=((event.loaded*8)/runtime);
								$("#speedtest-speed").text((speed[part]/1000000).toFixed(2));
								$("#speedtest-progress").val(event.loaded/event.total);
								if(!finished && runtime > 20)
								{
									finished=true;
									xhr.abort();
									if(part == 0)
									{
										part = 1;
										setShown("connect-prompt");
									}
									else
									{
										generateResults();
									}
								}
							});
							return xhr;
						}
					}).done(()=>{
						if(!finished)
						{
							if(part == 0)
							{
								part = 1;
								setShown("connect-prompt");
							}
							else
							{
								generateResults();
							}
						}
					}).fail(()=>{
						if(!finished)
						{
							setFailed();
						}
					});
				},
				continueWithWebRTC=()=>{
					if(part == 0)
					{
						continueWithSpeedtest();
						return;
					}
					let webrtc_ips = [],
					RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
					if(!RTCPeerConnection)
					{
						let win = document.getElementById("iframe").contentWindow;
						RTCPeerConnection = win.RTCPeerConnection
						|| win.mozRTCPeerConnection
						|| win.webkitRTCPeerConnection;
						if(!RTCPeerConnection)
						{
							results[0].p += 2;
							results[0].n.push("Your browser doesn't support WebRTC. This is good for your privacy, but may break some websites.");
							continueWithSpeedtest();
							return;
						}
					}
					let pc = new RTCPeerConnection({
						iceServers: [{urls: "stun:stun.services.mozilla.com"}]
					}, {
						optional: [{RtpDataChannels: true}]
					}),
					handleCandidate=candidate=>{
						webrtc_ips.push(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(candidate)[1]);
					};
					pc.onicecandidate=ice=>{
						if(ice.candidate)
						{
							handleCandidate(ice.candidate.candidate);
						}
					};
					pc.createDataChannel("");
					pc.createOffer(function(result)
					{
						pc.setLocalDescription(result, ()=>{}, ()=>{});
					}, ()=>{});
					setTimeout(()=>{
						pc.localDescription.sdp.split("\n").forEach(line=>{
							if(line.substr(0, 12) == "a=candidate:")
							{
								handleCandidate(line);
							}
						});
						let webrtc_leak = false;
						webrtc_ips.forEach(ip=>{
							if(ipv4[0] == ip)
							{
								results[0].n.push("Your IPv4 address was leaked via WebRTC.");
								webrtc_leak = true;
							}
							else if(ipv6[0] == ip)
							{
								results[0].n.push("Your IPv6 address was leaked via WebRTC.");
								webrtc_leak = true;
							}
						});
						if(!webrtc_leak)
						{
							results[0].p += 2;
						}
						continueWithSpeedtest();
					}, 1000);
				},
				continueWithIpv6=()=>{
					$("#info-progress").val(101 / 102);
					if(part == 1 && ipv6 == null)
					{
						results[0].t -= 2;
						results[0].n.push("You don't seem to get IPv6 from your ISP, so your VPN wasn't tested in this regard.");
						continueWithWebRTC();
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
							continueWithWebRTC();
						}).fail(()=>$.ajax("http://[2a01:4f8:c010:7a9::1]/").done(i=>{
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
							continueWithWebRTC();
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
							continueWithWebRTC();
						}));
					}
				};
				if(part == 1)
				{
					results={0:{p:0,t:8,n:[]}};
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
					}).fail(()=>$.ajax("http://116.202.23.174/").done(i=>{
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
			results[0].p += 2;
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
	speedscore=(Math.ceil((speedperc / 100) * 8) - 6);
	if(speedscore < 0)
	{
		speedscore = 0;
	}
	results[1] = {
		p: speedscore,
		t: 2,
		n: ["Your tunneled speed is ~" + speedperc.toFixed(2) + "% of your normal speed."]
	};
	dns[0].forEach(i=>{
		if(dns[1].indexOf(i) != -1)
		{
			dnsreq++;
			$.ajax("https://apimon.de/ip/" + i).done(data=>{
				if("as"in data&&"org"in data.as&&dnsleaks.indexOf(data.as.org)==-1)
				{
					dnsleaks.push(data.as.org);
				}
			}).always(()=>{
				dnsres++;
				$("#results-progress").val(dnsreq / dnsres);
				if(dnsres == dnsreq)
				{
					if(dnsleaks.length == 1 && (dnsleaks.indexOf("Cloudflare, Inc.") != -1 || dnsleaks.indexOf("Google LLC") != -1))
					{
						results[0].p += 2;
						results[0].n.push("Your VPN leaked your DNS servers but you seem to be using a public DNS server.");
					}
					else
					{
						dnsleaks.forEach(as=>results[0].n.push("DNS servers by " + as + " were leaked."));
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
