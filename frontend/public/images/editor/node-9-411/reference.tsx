/**
 * Figma Design Reference: node 9:411
 * MapEditor - Editor Shell Layout
 *
 * Source: https://www.figma.com/design/PMIlpOjffPYTDB4nlDI3lQ/naotu?node-id=9-411
 *
 * This is the reference React+Tailwind code from Figma MCP.
 * Convert to match project technology stack before implementation.
 */

const imgContainer = "/images/editor/node-9-411/icon-select.svg";
const imgContainer1 = "/images/editor/node-9-411/icon-add-node.svg";
const imgContainer2 = "/images/editor/node-9-411/icon-connect.svg";
const imgContainer3 = "/images/editor/node-9-411/icon-styles.svg";
const imgContainer4 = "/images/editor/node-9-411/icon-media.svg";
const imgSvg = "/images/editor/node-9-411/main-bg.svg";
const imgContainer5 = "/images/editor/node-9-411/icon-rocket.svg";
const imgContainer6 = "/images/editor/node-9-411/icon-marketing.svg";
const imgContainer7 = "/images/editor/node-9-411/icon-development.svg";
const imgContainer8 = "/images/editor/node-9-411/icon-sales.svg";
const imgContainer9 = "/images/editor/node-9-411/icon-social.svg";
const imgContainer10 = "/images/editor/node-9-411/icon-email.svg";
const imgContainer11 = "/images/editor/node-9-411/icon-zoom-in.svg";
const imgContainer12 = "/images/editor/node-9-411/icon-zoom-out.svg";
const imgContainer13 = "/images/editor/node-9-411/icon-fit.svg";
const imgContainer14 = "/images/editor/node-9-411/icon-lock.svg";
const imgContainer15 = "/images/editor/node-9-411/icon-node-properties.svg";
const imgContainer16 = "/images/editor/node-9-411/icon-chevron-down.svg";
const imgContainer17 = "/images/editor/node-9-411/icon-logo.svg";
const imgContainer18 = "/images/editor/node-9-411/icon-arrow-down.svg";
const imgContainer19 = "/images/editor/node-9-411/icon-share.svg";
const imgContainer20 = "/images/editor/node-9-411/icon-export.svg";

export default function MapEditorReference() {
  return (
    <div className="bg-[#061616] content-stretch flex flex-col items-start relative size-full" data-name="Body" data-node-id="9:411">
      {/* Background Gradient */}
      <div className="absolute h-[1024px] left-0 top-0 w-[1280px]" data-name="Gradient" data-node-id="9:412" style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\\'0 0 1280 1024\\' xmlns=\\'http://www.w3.org/2000/svg\\' preserveAspectRatio=\\'none\\'><rect x=\\'0\\' y=\\'0\\' height=\\'100%\\' width=\\'100%\\' fill=\\'url(%23grad)\\' opacity=\\'1\\'/><defs><radialGradient id=\\'grad\\' gradientUnits=\\'userSpaceOnUse\\' cx=\\'0\\' cy=\\'0\\' r=\\'10\\' gradientTransform=\\'matrix(81.96 0 0 81.96 640 512)\\'><stop stop-color=\\'rgba(10,45,45,1)\\' offset=\\'0\\'/><stop stop-color=\\'rgba(6,22,22,1)\\' offset=\\'1\\'/></radialGradient></defs></svg>')" }} />

      {/* Left Aside - Toolbar */}
      <div className="absolute backdrop-blur-[6px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex flex-col gap-[24px] h-[373px] items-center left-[24px] px-px py-[25px] rounded-[16px] top-[325.5px] w-[64px]" data-name="Aside" data-node-id="9:413">
        {/* Select Button */}
        <div className="relative rounded-[12px] shrink-0" data-name="Button" data-node-id="9:414">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[8px] relative">
            <div className="relative shrink-0 size-[16.672px]" data-name="Container" data-node-id="9:415">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer} />
            </div>
            {/* Tooltip */}
            <div className="absolute bg-[#061616] content-stretch flex flex-col items-center left-[64px] opacity-0 px-[8px] py-[4px] rounded-[12px] top-[8px]" data-name="Background" data-node-id="9:417">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] relative shrink-0 text-[#94a3b8] text-[12px] text-center w-[54.06px]" data-node-id="9:418">
                <p className="leading-[16px]">Select (V)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Node Button - Active */}
        <div className="bg-[rgba(195,20,50,0.2)] border border-[rgba(195,20,50,0.5)] border-solid relative rounded-[12px] shrink-0" data-name="Button" data-node-id="9:419">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[9px] relative">
            <div className="relative shrink-0 size-[19.969px]" data-name="Container" data-node-id="9:420">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer1} />
            </div>
            <div className="absolute bg-[#061616] left-[64px] opacity-0 rounded-[12px] top-[8px]" data-name="Background" data-node-id="9:422">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center px-[8px] py-[4px] relative">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-center text-white w-[75.67px]" data-node-id="9:423">
                  <p className="leading-[16px]">Add Node (N)</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)]" />
        </div>

        {/* Connect Button */}
        <div className="relative rounded-[12px] shrink-0" data-name="Button" data-node-id="9:424">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[8px] relative">
            <div className="h-[12px] relative shrink-0 w-[22.031px]" data-name="Container" data-node-id="9:425">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer2} />
            </div>
            <div className="absolute bg-[#061616] content-stretch flex flex-col items-center left-[64px] opacity-0 px-[8px] py-[4px] rounded-[12px] top-[8px]" data-name="Background" data-node-id="9:427">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] relative shrink-0 text-[#94a3b8] text-[12px] text-center w-[68.59px]" data-node-id="9:428">
                <p className="leading-[16px]">Connect (C)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="bg-[rgba(255,255,255,0.1)] h-px shrink-0 w-[32px]" data-name="Horizontal Divider" data-node-id="9:429" />

        {/* Styles Button */}
        <div className="relative rounded-[12px] shrink-0" data-name="Button" data-node-id="9:430">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[8px] relative">
            <div className="relative shrink-0 size-[19.969px]" data-name="Container" data-node-id="9:431">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer3} />
            </div>
            <div className="absolute bg-[#061616] content-stretch flex flex-col items-center left-[64px] opacity-0 px-[8px] py-[4px] rounded-[12px] top-[8px]" data-name="Background" data-node-id="9:433">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] relative shrink-0 text-[#94a3b8] text-[12px] text-center w-[35.08px]" data-node-id="9:434">
                <p className="leading-[16px]">Styles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Media Button */}
        <div className="relative rounded-[12px] shrink-0" data-name="Button" data-node-id="9:435">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[8px] relative">
            <div className="relative shrink-0 size-[18px]" data-name="Container" data-node-id="9:436">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer4} />
            </div>
            <div className="absolute bg-[#061616] content-stretch flex flex-col items-center left-[64px] opacity-0 px-[8px] py-[4px] rounded-[12px] top-[8px]" data-name="Background" data-node-id="9:438">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] relative shrink-0 text-[#94a3b8] text-[12px] text-center w-[35.03px]" data-node-id="9:439">
                <p className="leading-[16px]">Media</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="content-stretch flex h-[1024px] items-center justify-center overflow-clip pt-[64px] relative shrink-0 w-full" data-name="Main" data-node-id="9:440">
        {/* Background SVG */}
        <div className="absolute h-[1024px] left-0 top-0 w-[1280px]" data-name="SVG" data-node-id="9:441">
          <img alt="" className="absolute block max-w-none size-full" src={imgSvg} />
        </div>

        {/* Container */}
        <div className="flex-[1_0_0] h-full min-h-px min-w-px relative" data-name="Container" data-node-id="9:447">
          {/* Main Node Card */}
          <div className="absolute backdrop-blur-[4px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] border-solid h-[179px] left-[250px] rounded-[16px] top-[360px] w-[224px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:448">
            <div className="absolute bg-[rgba(255,255,255,0)] bottom-[-1px] left-[-1px] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] top-[-1px] w-[224px]" data-name="Overlay+Shadow" data-node-id="9:449" />
            {/* Icon */}
            <div className="absolute content-stretch flex flex-col h-[44px] items-start left-[91px] pb-[4px] top-[24px] w-[40px]" data-name="Margin" data-node-id="9:450">
              <div className="bg-[rgba(195,20,50,0.2)] content-stretch flex items-center justify-center relative rounded-[8px] shrink-0 size-[40px]" data-name="Overlay" data-node-id="9:451">
                <div className="relative shrink-0 size-[19.288px]" data-name="Container" data-node-id="9:452">
                  <img alt="" className="absolute block max-w-none size-full" src={imgContainer5} />
                </div>
              </div>
            </div>
            {/* Title */}
            <div className="-translate-x-1/2 absolute content-stretch flex flex-col items-center left-1/2 pb-[0.75px] pl-[18.16px] pr-[18.17px] top-[79.25px]" data-name="Heading 3" data-node-id="9:454">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[45px] justify-center leading-[22.5px] relative shrink-0 text-[18px] text-center text-white w-[137.67px]" data-node-id="9:455">
                <p className="mb-0">Product Launch</p>
                <p>Strategy</p>
              </div>
            </div>
            {/* Tags */}
            <div className="absolute content-stretch flex flex-col items-start left-[91px] pt-[8px] top-[137px]" data-name="Margin" data-node-id="9:456">
              <div className="content-stretch flex gap-[8px] items-start relative shrink-0" data-name="Container" data-node-id="9:457">
                <div className="bg-[#4ade80] rounded-[9999px] shrink-0 size-[8px]" data-name="Background" data-node-id="9:458" />
                <div className="bg-[#60a5fa] rounded-[9999px] shrink-0 size-[8px]" data-name="Background" data-node-id="9:459" />
                <div className="bg-[#c31432] rounded-[9999px] shrink-0 size-[8px]" data-name="Background" data-node-id="9:460" />
              </div>
            </div>
          </div>

          {/* Marketing Plan Node */}
          <div className="absolute backdrop-blur-[4px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] border-solid content-stretch flex gap-[12px] items-center left-[550px] p-[17px] rounded-[12px] top-[225px] w-[176px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:461">
            <div className="h-[15.207px] relative shrink-0 w-[19.969px]" data-name="Container" data-node-id="9:462">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer6} />
            </div>
            <div className="relative shrink-0" data-name="Container" data-node-id="9:464">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Semi_Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-white w-[99.48px]" data-node-id="9:465">
                  <p className="leading-[20px]">Marketing Plan</p>
                </div>
              </div>
            </div>
          </div>

          {/* Development Node */}
          <div className="absolute backdrop-blur-[4px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] border-solid content-stretch flex gap-[12px] items-center left-[550px] p-[17px] rounded-[12px] top-[375px] w-[176px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:466">
            <div className="h-[11.156px] relative shrink-0 w-[19.195px]" data-name="Container" data-node-id="9:467">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer7} />
            </div>
            <div className="relative shrink-0" data-name="Container" data-node-id="9:469">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Semi_Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-white w-[92.23px]" data-node-id="9:470">
                  <p className="leading-[20px]">Development</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Funnel Node */}
          <div className="absolute backdrop-blur-[4px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] border-solid content-stretch flex gap-[12px] items-center left-[550px] p-[17px] rounded-[12px] top-[525px] w-[176px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:471">
            <div className="h-[16.031px] relative shrink-0 w-[22.031px]" data-name="Container" data-node-id="9:472">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer8} />
            </div>
            <div className="relative shrink-0" data-name="Container" data-node-id="9:474">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Semi_Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-white w-[83.31px]" data-node-id="9:475">
                  <p className="leading-[20px]">Sales Funnel</p>
                </div>
              </div>
            </div>
          </div>

          {/* Social Ads Node */}
          <div className="absolute backdrop-blur-[4px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] border-solid content-stretch flex gap-[12px] items-center left-[800px] p-[13px] rounded-[8px] top-[180px] w-[160px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:476">
            <div className="h-[13.328px] relative shrink-0 w-[13.324px]" data-name="Container" data-node-id="9:477">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer9} />
            </div>
            <div className="relative shrink-0" data-name="Container" data-node-id="9:479">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-white w-[59.5px]" data-node-id="9:480">
                  <p className="leading-[16px]">Social Ads</p>
                </div>
              </div>
            </div>
          </div>

          {/* Email Blast Node */}
          <div className="absolute backdrop-blur-[4px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] border-solid content-stretch flex gap-[12px] items-center left-[800px] p-[13px] rounded-[8px] top-[280px] w-[160px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:481">
            <div className="h-[10.688px] relative shrink-0 w-[13.313px]" data-name="Container" data-node-id="9:482">
              <img alt="" className="absolute block max-w-none size-full" src={imgContainer10} />
            </div>
            <div className="relative shrink-0" data-name="Container" data-node-id="9:484">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-white w-[61.83px]" data-node-id="9:485">
                  <p className="leading-[16px]">Email Blast</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute backdrop-blur-[6px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid bottom-[32px] content-stretch flex gap-[16px] items-center left-[38.75%] px-[25px] py-[13px] right-[38.75%] rounded-[9999px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:486">
          <div className="relative shrink-0" data-name="Container" data-node-id="9:487">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative">
              {/* Zoom Out */}
              <div className="content-stretch flex flex-col items-center justify-center p-[4px] relative rounded-[6px] shrink-0" data-name="Button" data-node-id="9:488">
                <div className="h-[1.969px] relative shrink-0 w-[13.969px]" data-name="Container" data-node-id="9:489">
                  <img alt="" className="absolute block max-w-none size-full" src={imgContainer11} />
                </div>
              </div>
              {/* Zoom Level */}
              <div className="content-stretch flex flex-col items-center relative shrink-0 w-[48px]" data-name="Container" data-node-id="9:491">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-center text-white w-[34.39px]" data-node-id="9:492">
                  <p className="leading-[16px]">100%</p>
                </div>
              </div>
              {/* Zoom In */}
              <div className="content-stretch flex flex-col items-center justify-center p-[4px] relative rounded-[6px] shrink-0" data-name="Button" data-node-id="9:493">
                <div className="relative shrink-0 size-[13.969px]" data-name="Container" data-node-id="9:494">
                  <img alt="" className="absolute block max-w-none size-full" src={imgContainer12} />
                </div>
              </div>
            </div>
          </div>
          {/* Divider */}
          <div className="bg-[rgba(255,255,255,0.2)] h-[16px] shrink-0 w-px" data-name="Vertical Divider" data-node-id="9:496" />
          {/* Fit Button */}
          <div className="relative rounded-[6px] shrink-0" data-name="Button" data-node-id="9:497">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[4px] relative">
              <div className="relative shrink-0 size-[10.5px]" data-name="Container" data-node-id="9:498">
                <img alt="" className="absolute block max-w-none size-full" src={imgContainer13} />
              </div>
            </div>
          </div>
          {/* Divider */}
          <div className="bg-[rgba(255,255,255,0.2)] h-[16px] shrink-0 w-px" data-name="Vertical Divider" data-node-id="9:500" />
          {/* Lock Button */}
          <div className="relative rounded-[6px] shrink-0" data-name="Button" data-node-id="9:501">
            <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center p-[4px] relative">
              <div className="h-[10.474px] relative shrink-0 w-[10.477px]" data-name="Container" data-node-id="9:502">
                <img alt="" className="absolute block max-w-none size-full" src={imgContainer14} />
              </div>
            </div>
          </div>
        </div>

        {/* Navigator */}
        <div className="absolute backdrop-blur-[6px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid bottom-[32px] h-[112px] opacity-60 overflow-clip right-[32px] rounded-[12px] w-[160px]" data-name="Overlay+Border+OverlayBlur" data-node-id="9:504">
          <div className="absolute bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.05)] border-b border-solid content-stretch flex flex-col items-start left-0 pb-[9px] pt-[8px] px-[8px] right-0 top-0" data-name="Overlay+HorizontalBorder" data-node-id="9:505">
            <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#64748b] text-[10px] tracking-[0.5px] uppercase w-[63.48px]" data-node-id="9:506">
              <p className="leading-[15px]">Navigator</p>
            </div>
          </div>
          <div className="absolute inset-[32px_0_-32px_0]" data-name="Container" data-node-id="9:507">
            <div className="absolute bg-[rgba(195,20,50,0.4)] blur-[0.5px] h-[24px] left-[16px] rounded-[2px] top-[32px] w-[32px]" data-name="Overlay+Blur" data-node-id="9:508" />
            <div className="absolute bg-[rgba(96,165,250,0.3)] blur-[0.5px] h-[16px] left-[64px] rounded-[2px] top-[16px] w-[24px]" data-name="Overlay+Blur" data-node-id="9:509" />
            <div className="absolute bg-[rgba(96,165,250,0.3)] blur-[0.5px] h-[16px] left-[64px] rounded-[2px] top-[40px] w-[24px]" data-name="Overlay+Blur" data-node-id="9:510" />
            <div className="absolute bg-[rgba(96,165,250,0.3)] blur-[0.5px] h-[16px] left-[64px] rounded-[2px] top-[64px] w-[24px]" data-name="Overlay+Blur" data-node-id="9:511" />
            <div className="absolute border border-[rgba(255,255,255,0.4)] border-solid h-[64px] left-[8px] top-[16px] w-[96px]" data-name="Border" data-node-id="9:512" />
          </div>
        </div>
      </div>

      {/* Right Aside - Node Properties */}
      <div className="absolute backdrop-blur-[6px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex flex-col h-[530px] items-start justify-between max-h-[819.2000122070312px] overflow-clip p-px right-[24px] rounded-[16px] top-[247px] w-[288px]" data-name="Aside" data-node-id="9:513">
        {/* Header */}
        <div className="border-[rgba(255,255,255,0.05)] border-b border-solid relative shrink-0 w-full" data-name="HorizontalBorder" data-node-id="9:514">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[21px] pt-[20px] px-[20px] relative w-full">
            <div className="relative shrink-0 w-full" data-name="Heading 2" data-node-id="9:515">
              <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative w-full">
                <div className="relative shrink-0 size-[18px]" data-name="Container" data-node-id="9:516">
                  <img alt="" className="absolute block max-w-none size-full" src={imgContainer15} />
                </div>
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[28px] justify-center leading-[0] relative shrink-0 text-[18px] text-white w-[143.88px]" data-node-id="9:518">
                  <p className="leading-[28px]">Node Properties</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Content */}
        <div className="relative shrink-0 w-full" data-name="Container" data-node-id="9:519">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[24px] items-start overflow-clip p-[20px] relative rounded-[inherit] w-full">
            {/* Label Text Input */}
            <div className="content-stretch flex flex-col gap-[8.5px] items-start relative shrink-0 w-full" data-name="Container" data-node-id="9:520">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Semi_Bold',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#94a3b8] text-[12px] tracking-[1.2px] uppercase w-[78.53px]" data-node-id="9:521">
                <p className="leading-[16px]">Label Text</p>
              </div>
              <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex items-start justify-center overflow-clip px-[13px] py-[9px] relative rounded-[8px] shrink-0 w-full" data-name="Input" data-node-id="9:522">
                <div className="flex-[1_0_0] min-h-px min-w-px relative" data-name="Container" data-node-id="9:523">
                  <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] w-full">
                    <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[14px] text-white w-full" data-node-id="9:524">
                      <p className="leading-[20px]">Product Launch Strategy</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Color */}
            <div className="content-stretch flex flex-col gap-[8.5px] items-start relative shrink-0 w-full" data-name="Container" data-node-id="9:525">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Semi_Bold',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#94a3b8] text-[12px] tracking-[1.2px] uppercase w-[99.89px]" data-node-id="9:526">
                <p className="leading-[16px]">Theme Color</p>
              </div>
              <div className="content-stretch flex gap-[18.8px] items-start relative shrink-0 w-full" data-name="Container" data-node-id="9:527">
                <div className="bg-[#c31432] relative rounded-[9999px] shrink-0 size-[32px]" data-name="Button" data-node-id="9:528">
                  <div className="absolute bg-[rgba(255,255,255,0)] left-0 rounded-[9999px] shadow-[0px_0px_0px_4px_white] size-[32px] top-0" data-name="Button:shadow" data-node-id="9:529" />
                </div>
                <div className="bg-[#3b82f6] rounded-[9999px] shrink-0 size-[32px]" data-name="Button" data-node-id="9:530" />
                <div className="bg-[#10b981] rounded-[9999px] shrink-0 size-[32px]" data-name="Button" data-node-id="9:531" />
                <div className="bg-[#f59e0b] rounded-[9999px] shrink-0 size-[32px]" data-name="Button" data-node-id="9:532" />
                <div className="bg-[#d946ef] rounded-[9999px] shrink-0 size-[32px]" data-name="Button" data-node-id="9:533" />
              </div>
            </div>

            {/* Node Icon */}
            <div className="content-stretch flex flex-col gap-[8.5px] items-start relative shrink-0 w-full" data-name="Container" data-node-id="9:534">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Semi_Bold',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#94a3b8] text-[12px] tracking-[1.2px] uppercase w-[80.41px]" data-node-id="9:535">
                <p className="leading-[16px]">Node Icon</p>
              </div>
              <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex gap-[12px] items-center p-[13px] relative rounded-[12px] shrink-0 w-full" data-name="Overlay+Border" data-node-id="9:536">
                <div className="relative shrink-0 size-[19.288px]" data-name="Container" data-node-id="9:537">
                  <img alt="" className="absolute block max-w-none size-full" src={imgContainer5} />
                </div>
                <div className="relative shrink-0" data-name="Container" data-node-id="9:539">
                  <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
                    <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[20px] justify-center leading-[0] relative shrink-0 text-[14px] text-white w-[98px]" data-node-id="9:540">
                      <p className="leading-[20px]">Rocket Launch</p>
                    </div>
                  </div>
                </div>
                <div className="flex-[1_0_0] min-h-px min-w-[14px] relative" data-name="Margin" data-node-id="9:541">
                  <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-end min-w-[inherit] pl-[60px] relative w-full">
                    <div className="h-[3.849px] relative shrink-0 w-[6.508px]" data-name="Container" data-node-id="9:542">
                      <img alt="" className="absolute block max-w-none size-full" src={imgContainer16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="bg-[rgba(255,255,255,0.05)] h-px shrink-0 w-full" data-name="Horizontal Divider" data-node-id="9:544" />

            {/* Toggles */}
            <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Container" data-node-id="9:545">
              {/* Auto-layout */}
              <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container" data-node-id="9:546">
                <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container" data-node-id="9:547">
                  <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[20px] justify-center leading-[0] relative shrink-0 text-[14px] text-white w-[79.52px]" data-node-id="9:548">
                    <p className="leading-[20px]">Auto-layout</p>
                  </div>
                </div>
                <div className="bg-[#c31432] h-[20px] relative rounded-[9999px] shrink-0 w-[40px]" data-name="Background" data-node-id="9:549">
                  <div className="absolute bg-white right-[4px] rounded-[9999px] size-[12px] top-[4px]" data-name="Background" data-node-id="9:550" />
                </div>
              </div>
              {/* Glass Effect */}
              <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container" data-node-id="9:551">
                <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container" data-node-id="9:552">
                  <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[20px] justify-center leading-[0] relative shrink-0 text-[14px] text-white w-[80.8px]" data-node-id="9:553">
                    <p className="leading-[20px]">Glass Effect</p>
                  </div>
                </div>
                <div className="bg-[#c31432] h-[20px] relative rounded-[9999px] shrink-0 w-[40px]" data-name="Background" data-node-id="9:554">
                  <div className="absolute bg-white right-[4px] rounded-[9999px] size-[12px] top-[4px]" data-name="Background" data-node-id="9:555" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <div className="bg-[rgba(255,255,255,0.05)] relative shrink-0 w-full" data-name="Overlay" data-node-id="9:556">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start p-[20px] relative w-full">
            <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex items-center justify-center px-px py-[9px] relative rounded-[8px] shrink-0 w-full" data-name="Button" data-node-id="9:557">
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-center text-white w-[80.9px]" data-node-id="9:558">
                <p className="leading-[16px]">DELETE NODE</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="absolute backdrop-blur-[6px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex h-[64px] items-center justify-between left-0 px-[25px] py-px right-0 top-0" data-name="Header" data-node-id="9:559">
        {/* Left Section */}
        <div className="relative shrink-0" data-name="Container" data-node-id="9:560">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative">
            {/* Logo */}
            <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Container" data-node-id="9:561">
              <div className="h-[28.77px] relative shrink-0 w-[30px]" data-name="Container" data-node-id="9:562">
                <img alt="" className="absolute block max-w-none size-full" src={imgContainer17} />
              </div>
              <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Heading 1" data-node-id="9:564">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[28px] justify-center leading-[0] relative shrink-0 text-[20px] text-white tracking-[-0.5px] w-[126.52px]" data-node-id="9:565">
                  <p>
                    <span className="leading-[28px]">{`MindFlow `}</span>
                    <span className="font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold leading-[28px] text-[#c31432]">Pro</span>
                  </p>
                </div>
              </div>
            </div>
            {/* Divider */}
            <div className="content-stretch flex flex-col h-[24px] items-start px-[8px] relative shrink-0 w-[17px]" data-name="Margin" data-node-id="9:566">
              <div className="bg-[rgba(255,255,255,0.1)] h-[24px] shrink-0 w-px" data-name="Vertical Divider" data-node-id="9:567" />
            </div>
            {/* Breadcrumb */}
            <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Container" data-node-id="9:568">
              <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container" data-node-id="9:569">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[20px] justify-center leading-[0] relative shrink-0 text-[#94a3b8] text-[14px] w-[97.88px]" data-node-id="9:570">
                  <p className="leading-[20px]">My Workspace</p>
                </div>
              </div>
              <div className="h-[6.508px] relative shrink-0 w-[3.849px]" data-name="Container" data-node-id="9:571">
                <img alt="" className="absolute block max-w-none size-full" src={imgContainer18} />
              </div>
              <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container" data-node-id="9:573">
                <div className="flex flex-col font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium h-[20px] justify-center leading-[0] relative shrink-0 text-[14px] text-white w-[105.11px]" data-node-id="9:574">
                  <p className="leading-[20px]">Untitled Project</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="relative shrink-0" data-name="Container" data-node-id="9:575">
          <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative">
            {/* Share Button */}
            <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid content-stretch flex gap-[8px] items-center px-[17px] py-[9px] relative rounded-[8px] shrink-0" data-name="Button" data-node-id="9:576">
              <div className="h-[14.941px] relative shrink-0 w-[13.5px]" data-name="Container" data-node-id="9:577">
                <img alt="" className="absolute block max-w-none size-full" src={imgContainer19} />
              </div>
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium h-[20px] justify-center leading-[0] relative shrink-0 text-[14px] text-center text-white w-[38.72px]" data-node-id="9:579">
                <p className="leading-[20px]">Share</p>
              </div>
            </div>
            {/* Export Button */}
            <div className="bg-[#c31432] content-stretch flex gap-[8px] items-center px-[16px] py-[8px] relative rounded-[8px] shrink-0" data-name="Button" data-node-id="9:580">
              <div className="absolute bg-[rgba(255,255,255,0)] inset-[0_0.48px_0_0] rounded-[8px] shadow-[0px_10px_15px_-3px_rgba(195,20,50,0.2),0px_4px_6px_-4px_rgba(195,20,50,0.2)]" data-name="Button:shadow" data-node-id="9:581" />
              <div className="h-[12.762px] relative shrink-0 w-[10.477px]" data-name="Container" data-node-id="9:582">
                <img alt="" className="absolute block max-w-none size-full" src={imgContainer20} />
              </div>
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium h-[20px] justify-center leading-[0] relative shrink-0 text-[14px] text-center text-white w-[44.69px]" data-node-id="9:584">
                <p className="leading-[20px]">Export</p>
              </div>
            </div>
            {/* Avatar */}
            <div className="border border-[rgba(255,255,255,0.2)] border-solid content-stretch flex items-center justify-center pb-[8.5px] pt-[7.5px] px-px relative rounded-[9999px] shrink-0 size-[32px]" data-name="Background+Border" data-node-id="9:585" style={{ backgroundImage: "linear-gradient(45deg, rgb(195, 20, 50) 0%, rgb(217, 70, 239) 100%)" }}>
              <div className="-translate-y-1/2 absolute bg-[rgba(255,255,255,0)] left-[-1px] rounded-[9999px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[32px] top-1/2" data-name="Overlay+Shadow" data-node-id="9:586" />
              <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-center text-white w-[13.61px]" data-node-id="9:587">
                <p className="leading-[16px]">JD</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
