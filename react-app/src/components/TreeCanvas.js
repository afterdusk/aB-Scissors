import React from "react";
import { withStyles } from "@material-ui/styles";
import { Group } from "@vx/group";
import { Tree } from "@vx/hierarchy";
import { hierarchy } from "d3-hierarchy";
import { LinkVerticalCurve, LinkVerticalLine } from "@vx/shape";
import NodeControlPanel from "./NodeControlPanel";
import DragScroll from "./DragScroll";
import * as Constants from "../Constants";

const styles = theme => ({
  clickable: {
    "&:hover": {
      filter: "url(#shadow)"
    }
  }
});

/* state vs props: 
    - props are read-only, passed from parent
    - state is private, can only be set by component
  variable vs state:
    - state, when modified, will call render
    - variable thus should be used for data that would not affect the DOM */

// TODO: Remove logic allowing for different configs, no need for config to be dynamic
// TODO: Set hard limits on tree height and max nodes (per node and for entire tree), ensure restrictions propagated to user
class TreeCanvas extends React.Component {
  initData = {
    id: 0,
    value: null,
    children: [
      {
        id: 1,
        value: null,
        children: [
          {
            id: 2,
            value: null,
            children: [
              { id: 3, value: 2, children: [] },
              { id: 4, value: 6, children: [] }
            ]
          },
          {
            id: 5,
            value: 1,
            children: []
          },
          {
            id: 6,
            value: null,
            children: [
              {
                id: 7,
                value: 4,
                children: []
              },
              {
                id: 8,
                value: 3,
                children: []
              }
            ]
          }
        ]
      },
      {
        id: 9,
        value: null,
        children: [
          {
            id: 10,
            value: null,
            children: [
              { id: 11, value: 5, children: [] },
              { id: 12, value: 7, children: [] }
            ]
          },
          {
            id: 13,
            value: 2,
            children: []
          }
        ]
      }
    ]
  };

  initIDs = new Set([...Array(14).keys()]);
  initCount = 14;
  initHeight = 4;
  initWidth = 6;

  state = {
    linkType: "line", // diagonal || step || curve || line
    data: this.initData,
    selectedNodeID: this.initData.id,
    nodeIDs: this.initIDs,
    nodeCount: this.initCount,
    treeHeight: this.initHeight,
    treeWidth: this.initWidth,
    canvasWidth:
      this.initWidth * Constants.TREE_NODE_HORIZONTAL_SPACING +
      Constants.CANVAS_PADDING * 2,
    canvasHeight:
      this.initHeight * Constants.TREE_NODE_VERTICAL_SPACING +
      Constants.CANVAS_PADDING_TOP +
      Constants.CANVAS_PADDING * 2
  };

  // callback function to modify child count of a node
  updateNodeChildren = event => {
    // TODO: Stop modifying state directly; remove use of forceUpdate()
    var nodeData = this.getNodeData(this.state.data, this.state.selectedNodeID);
    var childNodeCount = nodeData.children.length;
    var targetCount = parseInt(event.target.value, 10);
    if (targetCount < childNodeCount) {
      this.removeChildNodes(childNodeCount, targetCount, nodeData);
    } else {
      this.addChildNodes(childNodeCount, targetCount, nodeData);
    }
    this.updateCanvasSize(this.state.data);
    this.forceUpdate();
  };

  // callback function to modify value of a node
  updateNodeValue = event => {
    var nodeData = this.getNodeData(this.state.data, this.state.selectedNodeID);
    if (nodeData.children.length !== 0) {
      return;
    }
    nodeData.value = event.target.value;
    this.forceUpdate();
  };

  /*-------------------- Helper Functions -------------------- */
  // traverses tree JSON to get data of node specified by 'id'
  getNodeData(data, id) {
    var result = null;
    if (data.id === id) return data;
    for (let i = 0; i < data.children.length; i++) {
      result = this.getNodeData(data.children[i], id);
      if (result) break;
    }
    return result;
  }

  // NOTE: currently not used anywhere
  // traverses tree JSON to get height of node specified by 'id'
  getNodeDepth(data, id) {
    var result = null;
    if (data.id === id) return 1;
    for (let i = 0; i < data.children.length; i++) {
      result = this.getNodeDepth(data.children[i], id);
      if (result) {
        result += 1;
        break;
      }
    }
    return result;
  }

  // returns the tree height i.e. max depth of leaf nodes
  getTreeHeight(data) {
    var maxDepth = 0;
    for (let i = 0; i < data.children.length; i++) {
      var depth = this.getTreeHeight(data.children[i]);
      maxDepth = depth > maxDepth ? depth : maxDepth;
    }
    return maxDepth + 1;
  }

  // returns the tree width i.e. max number of nodes in any level
  getTreeWidth(data) {
    var queue = [];
    var maxWidth = 1;
    var width = 1;
    var nextWidth = 0;
    queue.push(data);
    while (queue.length !== 0) {
      var node = queue.shift();
      if (width === 0) {
        width = nextWidth;
        nextWidth = 0;
        maxWidth = width > maxWidth ? width : maxWidth;
      }
      nextWidth += node.children.length;
      width--;

      for (let i = 0; i < node.children.length; i++) {
        queue.push(node.children[i]);
      }
    }
    return maxWidth;
  }

  // removes child nodes from a node to a specified new count
  removeChildNodes(childNodeCount, targetCount, nodeData) {
    var newNodeIDs = new Set(this.state.nodeIDs);
    for (let i = childNodeCount - 1; i >= targetCount; i--) {
      var removedNode = nodeData.children.pop();
      newNodeIDs.delete(removedNode.id);
    }
    this.setState({ nodeIDs: newNodeIDs });
    // leaf nodes should have values
    if (targetCount === 0) {
      nodeData.value = 0;
    }
  }

  // adds child nodes to a node up until a specified new count
  addChildNodes(childNodeCount, targetCount, nodeData) {
    var newNodeIDs = new Set(this.state.nodeIDs);
    for (let i = childNodeCount; i < targetCount; i++) {
      var newID = 0;
      // TODO: Refine to ensure no infinite loop
      while (this.state.nodeIDs.has(newID)) {
        newID = Math.floor(
          Math.random() * Math.floor(Constants.TREE_NODE_ID_LIMIT)
        );
      }
      var newNode = {
        id: newID,
        value: 0,
        children: []
      };
      nodeData.children.push(newNode);
      newNodeIDs.add(newNode.id);
      this.setState({ nodeIDs: newNodeIDs });
    }
    // non-leaf nodes should not have values
    if (targetCount > 0) {
      nodeData.value = null;
    }
  }

  // updates canvas height and width according to tree height
  updateCanvasSize(data) {
    var height = this.getTreeHeight(data);
    var width = this.getTreeWidth(data);
    if (height !== this.state.treeHeight || width !== this.state.treeWidth) {
      this.setState({
        treeHeight: height,
        canvasHeight:
          height * Constants.TREE_NODE_VERTICAL_SPACING +
          Constants.CANVAS_PADDING_TOP +
          Constants.CANVAS_PADDING * 2,
        treeWidth: width,
        canvasWidth:
          width * Constants.TREE_NODE_HORIZONTAL_SPACING +
          Constants.CANVAS_PADDING * 2
      });
    }
  }

  render() {
    const { classes } = this.props;

    const {
      margin = {
        top: Constants.CANVAS_PADDING + Constants.CANVAS_PADDING_TOP,
        left: Constants.CANVAS_PADDING,
        right: Constants.CANVAS_PADDING,
        bottom: Constants.CANVAS_PADDING
      }
    } = this.props;
    const nodeControlPanelStyle = {
      // TODO: Set dynamically with respect to AppBar
      position: "absolute",
      top: "60px",
      right: "0px",
      margin: "25px"
    };
    let origin = { x: 0, y: 0 };

    // for ease of reference
    const { linkType } = this.state;

    /* High Level DOM structure
    TODO: Consider abstracting tree to a separate component, 
    letting this component act as a controller
    -> svg
      -> Group
        -> Tree
          -> Group
            -> Edges 
            -> Nodes
              -> Group
    -> NodeControlPanel
    */
    return (
      <div>
        {/* Canvas */}
        <DragScroll width={"100vw"} height={"100vh"} overflow={"hidden"}>
          <svg
            style={{
              width: this.state.canvasWidth,
              height: this.state.canvasHeight,
              minWidth: "100%",
              minHeight: "100%"
            }}
          >
            {/* SVG custom elements */}
            <defs>
              <pattern
                id="smallGrid"
                width="12"
                height="12"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 12 0 L 0 0 0 12"
                  fill="none"
                  stroke={Constants.TREE_NODE_LINE_COLOR}
                  strokeOpacity="0.75"
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern
                id="grid"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <rect width="60" height="60" fill="url(#smallGrid)" />
                {/* <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke="gray"
                stroke-width="0.5"
              /> */}
              </pattern>
            </defs>
            <defs>
              <filter id="shadow">
                <feDropShadow dx="1" dy="1" stdDeviation="2" />
              </filter>
            </defs>

            {/* Background */}
            <rect width={"100%"} height={"100%"} fill="url(#grid)" />

            {/* Group containing Tree */}
            <Group top={margin.top} left={margin.left}>
              <Tree
                root={hierarchy(this.state.data, d =>
                  d.isCollapsed ? null : d.children
                )}
                size={[
                  this.state.canvasWidth - margin.left - margin.right,
                  this.state.canvasHeight - margin.top - margin.bottom
                ]}
                /* if a and b have same parent, separation is half compared to
                 if a and b are from separate parents*/
                separation={(a, b) => (a.parent === b.parent ? 1 : 2)}
              >
                {rootNode => (
                  <Group top={origin.y} left={origin.x}>
                    {/* render edges */}
                    {rootNode.links().map((link, linkKey) => {
                      let LinkComponent;

                      if (linkType === "curve") {
                        LinkComponent = LinkVerticalCurve;
                      } else if (linkType === "line") {
                        LinkComponent = LinkVerticalLine;
                      }

                      return (
                        <LinkComponent
                          // className={classes.clickable}
                          data={link}
                          stroke={Constants.TREE_NODE_LINE_COLOR}
                          strokeWidth="1"
                          fill="none"
                          key={linkKey}
                          onClick={data => event => {
                            // console.log(data);
                          }}
                        />
                      );
                    })}

                    {/* render nodes */}
                    {rootNode.descendants().map((node, nodeKey) => {
                      const radius = Constants.TREE_NODE_DIAMETER;

                      var top = node.y;
                      var left = node.x;

                      return (
                        <Group
                          className={classes.clickable}
                          top={top}
                          left={left}
                          key={nodeKey}
                        >
                          {
                            <circle
                              r={radius}
                              style={
                                node.data.id === this.state.selectedNodeID
                                  ? { filter: "url(#shadow)" }
                                  : {}
                              }
                              fill={
                                node.data.id === this.state.selectedNodeID
                                  ? Constants.TREE_NODE_SELECTED_FILL_COLOR
                                  : Constants.TREE_NODE_FILL_COLOR
                              }
                              stroke={
                                node.data.id === this.state.selectedNodeID
                                  ? Constants.TREE_NODE_SELECTED_LINE_COLOR
                                  : Constants.TREE_NODE_LINE_COLOR
                              }
                              strokeWidth={1}
                              // strokeDasharray={!node.data.children ? "2,2" : "0"}
                              // strokeOpacity={!node.data.children ? 0.6 : 1}
                              onClick={() => {
                                this.setState({ selectedNodeID: node.data.id });
                                // node.data.isCollapsed = !node.data.isCollapsed;
                                // console.log(node);
                                this.forceUpdate();
                              }}
                            />
                          }
                          <text
                            dy={".33em"}
                            fontSize={Constants.TREE_NODE_VALUE_FONT_SIZE}
                            fontWeight={Constants.TREE_NODE_VALUE_FONT_WEIGHT}
                            fontFamily="Roboto"
                            textAnchor={"middle"}
                            style={{ pointerEvents: "none" }}
                            fill={Constants.FONT_PRIMARY_COLOR}
                          >
                            {node.data.value}
                          </text>
                        </Group>
                      );
                    })}
                  </Group>
                )}
              </Tree>
            </Group>
          </svg>
        </DragScroll>

        {/* Node Control Panel */}
        <div style={nodeControlPanelStyle}>
          <NodeControlPanel
            nodeData={this.getNodeData(
              this.state.data,
              this.state.selectedNodeID
            )}
            updateNodeChildren={this.updateNodeChildren}
            updateNodeValue={this.updateNodeValue}
          />
        </div>
      </div>
    );
  }
}

export default withStyles(styles)(TreeCanvas);
